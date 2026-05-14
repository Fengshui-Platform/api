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

interface WesternZodiacData {
  sign: string
  signVi: string
  element: string
  elementVi: string
  modality: string
}

const WESTERN_ZODIAC: Array<{
  sign: string; signVi: string; element: string; elementVi: string; modality: string
  from: [number, number]; to: [number, number]
}> = [
  { sign: 'Aries',       signVi: 'Bạch Dương',  element: 'Fire',  elementVi: 'Lửa',  modality: 'Cardinal', from: [3,21], to: [4,19] },
  { sign: 'Taurus',      signVi: 'Kim Ngưu',    element: 'Earth', elementVi: 'Đất',  modality: 'Fixed',    from: [4,20], to: [5,20] },
  { sign: 'Gemini',      signVi: 'Song Tử',     element: 'Air',   elementVi: 'Khí',  modality: 'Mutable',  from: [5,21], to: [6,20] },
  { sign: 'Cancer',      signVi: 'Cự Giải',     element: 'Water', elementVi: 'Nước', modality: 'Cardinal', from: [6,21], to: [7,22] },
  { sign: 'Leo',         signVi: 'Sư Tử',       element: 'Fire',  elementVi: 'Lửa',  modality: 'Fixed',    from: [7,23], to: [8,22] },
  { sign: 'Virgo',       signVi: 'Xử Nữ',       element: 'Earth', elementVi: 'Đất',  modality: 'Mutable',  from: [8,23], to: [9,22] },
  { sign: 'Libra',       signVi: 'Thiên Bình',  element: 'Air',   elementVi: 'Khí',  modality: 'Cardinal', from: [9,23], to: [10,22] },
  { sign: 'Scorpio',     signVi: 'Bọ Cạp',      element: 'Water', elementVi: 'Nước', modality: 'Fixed',    from: [10,23], to: [11,21] },
  { sign: 'Sagittarius', signVi: 'Nhân Mã',     element: 'Fire',  elementVi: 'Lửa',  modality: 'Mutable',  from: [11,22], to: [12,21] },
  { sign: 'Capricorn',   signVi: 'Ma Kết',      element: 'Earth', elementVi: 'Đất',  modality: 'Cardinal', from: [12,22], to: [1,19] },
  { sign: 'Aquarius',    signVi: 'Bảo Bình',    element: 'Air',   elementVi: 'Khí',  modality: 'Fixed',    from: [1,20], to: [2,18] },
  { sign: 'Pisces',      signVi: 'Song Ngư',    element: 'Water', elementVi: 'Nước', modality: 'Mutable',  from: [2,19], to: [3,20] },
]

function getWesternZodiac(birthDate: string): WesternZodiacData {
  const parts = birthDate.split('-').map(Number)
  const month = parts[1] ?? 1
  const day   = parts[2] ?? 1
  const md = month * 100 + day

  for (const z of WESTERN_ZODIAC) {
    const from = z.from[0] * 100 + z.from[1]
    const to   = z.to[0]   * 100 + z.to[1]

    if (from <= to) {
      if (md >= from && md <= to) return z
    } else {
      // Capricorn spans Dec 22 → Jan 19 (crosses year boundary)
      if (md >= from || md <= to) return z
    }
  }
  // Fallback: Pisces (should never happen with valid date)
  return WESTERN_ZODIAC[11]!
}

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

    let zodiacVars: Record<string, string> = {}
    if (module === 'zodiac') {
      const z = getWesternZodiac(input.birth_date)
      zodiacVars = {
        zodiac_sign:       z.sign,
        zodiac_sign_vi:    z.signVi,
        zodiac_element:    z.element,
        zodiac_element_vi: z.elementVi,
        zodiac_modality:   z.modality,
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
      ...zodiacVars,
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
