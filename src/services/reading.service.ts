import { ReadingModel } from '@/models/reading.model'
import { UserModel } from '@/models/user.model'
import { CreditUsageLogModel } from '@/models/creditUsageLog.model'
import { FreeUsageLogModel } from '@/models/freeUsageLog.model'
import { AiService } from '@/services/ai.service'
import { getPrompt } from '@/prompts'
import { createError } from '@/utils/response'
import { logger } from '@/utils/logger'
import type { ReadingModule, ReadingResult, ReadingInputDto } from '@/types/reading.types'

// Simple Pythagorean numerology helpers
function sumDigits(n: number): number {
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
    n = String(n).split('').reduce((a, d) => a + Number(d), 0)
  }
  return n
}

function letterValue(ch: string): number {
  const map: Record<string, number> = {
    a: 1, j: 1, s: 1,
    b: 2, k: 2, t: 2,
    c: 3, l: 3, u: 3,
    d: 4, m: 4, v: 4,
    e: 5, n: 5, w: 5,
    f: 6, o: 6, x: 6,
    g: 7, p: 7, y: 7,
    h: 8, q: 8, z: 8,
    i: 9, r: 9,
  }
  return map[ch.toLowerCase()] ?? 0
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])

export function computeNumerology(fullName: string, birthDate: string) {
  const [year, month, day] = birthDate.split('-').map(Number)
  const lifePathNumber = sumDigits((year ?? 0) + (month ?? 0) + (day ?? 0))

  const letters = fullName.toLowerCase().replace(/[^a-z]/g, '').split('')
  const vowelSum = letters.filter(c => VOWELS.has(c)).reduce((a, c) => a + letterValue(c), 0)
  const consonantSum = letters.filter(c => !VOWELS.has(c)).reduce((a, c) => a + letterValue(c), 0)
  const totalSum = letters.reduce((a, c) => a + letterValue(c), 0)

  return {
    life_path_number: lifePathNumber,
    soul_number: sumDigits(vowelSum),
    personality_number: sumDigits(consonantSum),
    destiny_number: sumDigits(totalSum),
  }
}

export const ReadingService = {
  async performFreeReading(
    input: ReadingInputDto,
    module: ReadingModule,
    ip: string,
    sessionId?: string,
    userId?: number
  ): Promise<{ readingId: number; result: ReadingResult }> {
    const alreadyUsed = await FreeUsageLogModel.hasUsedFreeToday(ip, sessionId)
    if (alreadyUsed) {
      throw createError('FREE_LIMIT', 'Bạn đã dùng lượt miễn phí hôm nay. Quay lại sau 0h hoặc mua lượt để xem thêm.', 429)
    }

    const prompt = getPrompt(module, 'free')

    const numerology = module === 'numerology' ? computeNumerology(input.full_name, input.birth_date) : {}

    const userPrompt = AiService.buildPrompt(prompt.user_template, {
      full_name: input.full_name,
      birth_date: input.birth_date,
      phone: input.phone ?? '',
      gender: input.gender ?? '',
      ...Object.fromEntries(Object.entries(numerology).map(([k, v]) => [k, String(v)])),
    })

    const aiResult = await AiService.call(prompt.system_prompt, userPrompt)

    let parsedResult: ReadingResult
    try {
      parsedResult = AiService.parseJsonResponse<ReadingResult>(aiResult.content)
    } catch {
      logger.warn(`[reading.service] parseJsonResponse failed for free ${module}, storing fallback`)
      parsedResult = {
        summary: 'Kết quả phân tích đang được xử lý. Vui lòng thử lại.',
        sections: {},
        ...numerology,
      }
    }

    const readingId = await ReadingModel.create({
      user_id: userId ?? null,
      session_id: sessionId ?? null,
      ip_address: ip,
      module,
      input_data: JSON.stringify(input),
      result_data: JSON.stringify(parsedResult),
      ai_model_id: aiResult.modelId,
      tokens_used: aiResult.tokensUsed,
      is_free: true,
      credits_used: 0,
    })

    await FreeUsageLogModel.log(ip, sessionId)

    return { readingId, result: parsedResult }
  },

  async performPaidReading(
    userId: number,
    input: ReadingInputDto,
    module: ReadingModule
  ): Promise<{ readingId: number; result: ReadingResult }> {
    const user = await UserModel.findById(userId)
    if (!user) throw createError('USER_NOT_FOUND', 'Người dùng không tồn tại', 404)

    const prompt = getPrompt(module, 'paid')

    const numerology = computeNumerology(input.full_name, input.birth_date)

    let partnerNumerology: Record<string, string> = {}
    if (module === 'love' && input.partner_name && input.partner_birth_date) {
      const pn = computeNumerology(input.partner_name, input.partner_birth_date)
      partnerNumerology = {
        partner_life_path:    String(pn.life_path_number),
        partner_soul:         String(pn.soul_number),
        partner_personality:  String(pn.personality_number),
        partner_destiny:      String(pn.destiny_number),
      }
    }

    const userPrompt = AiService.buildPrompt(prompt.user_template, {
      full_name:           input.full_name,
      birth_date:          input.birth_date,
      phone:               input.phone ?? '',
      gender:              input.gender ?? '',
      partner_name:        input.partner_name ?? '',
      partner_birth_date:  input.partner_birth_date ?? '',
      house_direction:     input.house_direction ?? '',
      current_year:        String(new Date().getFullYear()),
      ...Object.fromEntries(Object.entries(numerology).map(([k, v]) => [k, String(v)])),
      ...partnerNumerology,
    })

    const aiResult = await AiService.call(prompt.system_prompt, userPrompt)

    let parsedResult: ReadingResult
    try {
      parsedResult = AiService.parseJsonResponse<ReadingResult>(aiResult.content)
    } catch {
      logger.warn(`[reading.service] parseJsonResponse failed for paid ${module}, storing fallback`)
      parsedResult = {
        summary: 'Kết quả phân tích đang được xử lý. Vui lòng thử lại.',
        sections: {},
        ...numerology,
      }
    }

    // Deduct credit and log — done in a sequence to ensure consistency
    await UserModel.deductCredit(userId)
    const updatedUser = await UserModel.findById(userId)

    const readingId = await ReadingModel.create({
      user_id: userId,
      session_id: null,
      ip_address: null,
      module,
      input_data: JSON.stringify(input),
      result_data: JSON.stringify(parsedResult),
      ai_model_id: aiResult.modelId,
      tokens_used: aiResult.tokensUsed,
      is_free: false,
      credits_used: 1,
    })

    await CreditUsageLogModel.create({
      userId,
      readingId,
      module,
      creditsUsed: 1,
      balanceAfter: updatedUser?.credits_balance ?? 0,
    })

    return { readingId, result: parsedResult }
  },

  async getHistory(
    userId: number,
    opts: { module?: ReadingModule; page: number; limit: number }
  ) {
    return ReadingModel.findAll({ userId, ...opts })
  },
}
