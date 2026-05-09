import type { Request, Response, NextFunction } from 'express'
import { ReadingModel } from '@/models/reading.model'
import { paginated } from '@/utils/response'
import { parsePagination } from '@/types/api.types'
import type { ReadingModule } from '@/types/reading.types'

const VALID_MODULES: ReadingModule[] = ['numerology', 'love', 'finance', 'sim', 'fengshui_home', 'horoscope']

export const AdminReadingController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query as { page?: string; limit?: string })
      const userId   = req.query.user_id ? Number(req.query.user_id) : undefined
      const module   = req.query.module as ReadingModule | undefined
      const isFree   = req.query.is_free !== undefined
        ? req.query.is_free === '1' || req.query.is_free === 'true'
        : undefined

      if (module && !VALID_MODULES.includes(module)) {
        const { createError } = await import('@/utils/response')
        return next(createError('INVALID_MODULE', 'Module không hợp lệ', 400))
      }

      const { rows, total } = await ReadingModel.findAll({ userId, module, isFree, page, limit })
      return res.json(paginated(rows, total, page, limit))
    } catch (err) { next(err) }
  },
}
