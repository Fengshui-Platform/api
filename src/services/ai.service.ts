import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import axios from 'axios'
import { AIModelModel, type AiModelRow } from '@/models/aiModel.model'
import { decrypt } from '@/utils/crypto'
import { logger } from '@/utils/logger'
import { createError } from '@/utils/response'

export interface AiCallResult {
  content: string
  tokensUsed: number
  modelId: number
  modelName: string
}

function buildPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

async function callOpenAI(model: AiModelRow, systemPrompt: string, userPrompt: string): Promise<AiCallResult> {
  const apiKey = decrypt(model.api_key_encrypted)
  const client = new OpenAI({ apiKey })

  const response = await client.chat.completions.create({
    model: model.model_id,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: model.max_tokens,
    temperature: model.temperature,
  })

  const content = response.choices[0]?.message?.content ?? ''
  const tokensUsed = response.usage?.total_tokens ?? 0

  return { content, tokensUsed, modelId: model.id, modelName: model.name }
}

async function callAnthropic(model: AiModelRow, systemPrompt: string, userPrompt: string): Promise<AiCallResult> {
  const apiKey = decrypt(model.api_key_encrypted)
  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: model.model_id,
    max_tokens: model.max_tokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  const content = textBlock?.type === 'text' ? textBlock.text : ''
  const tokensUsed = (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0)

  return { content, tokensUsed, modelId: model.id, modelName: model.name }
}

async function callGemini(model: AiModelRow, systemPrompt: string, userPrompt: string): Promise<AiCallResult> {
  const apiKey = decrypt(model.api_key_encrypted)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.model_id}:generateContent?key=${apiKey}`

  const response = await axios.post(url, {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      maxOutputTokens: model.max_tokens,
      temperature: model.temperature,
    },
  })

  const content: string = response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const tokensUsed: number =
    (response.data?.usageMetadata?.promptTokenCount ?? 0) +
    (response.data?.usageMetadata?.candidatesTokenCount ?? 0)

  return { content, tokensUsed, modelId: model.id, modelName: model.name }
}

async function callModel(model: AiModelRow, systemPrompt: string, userPrompt: string): Promise<AiCallResult> {
  switch (model.provider) {
    case 'openai':
      return callOpenAI(model, systemPrompt, userPrompt)
    case 'anthropic':
      return callAnthropic(model, systemPrompt, userPrompt)
    case 'gemini':
      return callGemini(model, systemPrompt, userPrompt)
    default:
      throw createError('UNKNOWN_PROVIDER', `Unknown AI provider: ${model.provider}`, 500)
  }
}

export const AiService = {
  buildPrompt,

  /**
   * Call AI with automatic fallback through active models.
   * Tries models in order: default first, then by priority.
   * Increments token usage on success.
   */
  async call(
    systemPrompt: string,
    userPrompt: string,
    preferredModelId?: number
  ): Promise<AiCallResult> {
    const activeModels = await AIModelModel.getActiveModels()
    if (activeModels.length === 0) {
      throw createError('NO_AI_MODEL', 'Không có AI model nào khả dụng', 503)
    }

    // Reorder: put preferred model first if specified
    let orderedModels = activeModels
    if (preferredModelId) {
      const preferred = activeModels.find(m => m.id === preferredModelId)
      if (preferred) {
        orderedModels = [preferred, ...activeModels.filter(m => m.id !== preferredModelId)]
      }
    }

    let lastError: unknown
    for (const model of orderedModels) {
      try {
        const result = await callModel(model, systemPrompt, userPrompt)
        // Fire-and-forget token update
        AIModelModel.incrementTokens(model.id, result.tokensUsed).catch(err =>
          logger.error('Failed to increment token count:', err)
        )
        return result
      } catch (err) {
        lastError = err
        logger.warn(`AI model ${model.name} (${model.provider}) failed, trying next:`, err)
      }
    }

    logger.error('All AI models failed. Last error:', lastError)
    throw createError('AI_FAILED', 'Dịch vụ AI tạm thời không khả dụng, vui lòng thử lại sau', 503)
  },

  /**
   * Parse JSON from AI response, handling markdown code fences.
   */
  parseJsonResponse<T = unknown>(content: string): T {
    // Strip markdown code fences if present
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()
    try {
      return JSON.parse(cleaned) as T
    } catch {
      throw createError('AI_PARSE_ERROR', 'Không thể phân tích kết quả từ AI', 500)
    }
  },
}
