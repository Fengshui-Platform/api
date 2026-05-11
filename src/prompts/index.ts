import type { ReadingModule, PromptTier } from '@/types/reading.types'
import { createError } from '@/utils/response'
import { numerologyFreePrompt, numerologyPaidPrompt } from './numerology'
import { lovePaidPrompt } from './love'
import { financePaidPrompt } from './finance'
import { simPaidPrompt } from './sim'
import { fengshuiHomePaidPrompt } from './fengshui_home'
import { horoscopePaidPrompt } from './horoscope'

export interface PromptDefinition {
  system_prompt: string
  user_template: string
}

type PromptMap = Partial<Record<PromptTier, PromptDefinition>>
type Registry = Partial<Record<ReadingModule, PromptMap>>

const registry: Registry = {
  numerology: {
    free: numerologyFreePrompt,
    paid: numerologyPaidPrompt,
  },
  love: {
    paid: lovePaidPrompt,
  },
  finance: {
    paid: financePaidPrompt,
  },
  sim: {
    paid: simPaidPrompt,
  },
  fengshui_home: {
    paid: fengshuiHomePaidPrompt,
  },
  horoscope: {
    paid: horoscopePaidPrompt,
  },
}

export function getPrompt(module: ReadingModule, tier: PromptTier): PromptDefinition {
  const prompt = registry[module]?.[tier]
  if (!prompt) {
    throw createError('NO_PROMPT', `Chức năng "${module}" chưa được hỗ trợ`, 503)
  }
  return prompt
}
