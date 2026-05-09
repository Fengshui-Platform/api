import type { Request, Response, NextFunction } from 'express'
import { ReadingService } from '@/services/reading.service'
import { ReadingModel } from '@/models/reading.model'
import { success, paginated, createError } from '@/utils/response'
import { parsePagination } from '@/types/api.types'
import type { ReadingModule } from '@/types/reading.types'

const VALID_MODULES: ReadingModule[] = ['numerology', 'love', 'finance', 'sim', 'fengshui_home', 'horoscope']

export const ReadingController = {
  async freeReading(req: Request, res: Response, next: NextFunction) {
    try {
      const { module } = req.params as { module: string }
      if (!VALID_MODULES.includes(module as ReadingModule)) {
        return next(createError('INVALID_MODULE', 'Module không hợp lệ', 400))
      }

      const rawIp = req.ip ?? req.socket.remoteAddress ?? 'unknown'
      const ip = rawIp === '::1' ? '127.0.0.1' : rawIp.replace(/^::ffff:/, '')
      const sessionId: string | undefined = req.cookies?.session_id

      const { readingId, result } = await ReadingService.performFreeReading(
        req.body,
        module as ReadingModule,
        ip,
        sessionId,
        req.user?.id
      )

      return res.json(success({ readingId, result }, 'Xem bói miễn phí thành công'))
    } catch (err) { next(err) }
  },

  async paidReading(req: Request, res: Response, next: NextFunction) {
    try {
      const { module } = req.params as { module: string }
      if (!VALID_MODULES.includes(module as ReadingModule)) {
        return next(createError('INVALID_MODULE', 'Module không hợp lệ', 400))
      }

      const { readingId, result } = await ReadingService.performPaidReading(
        req.user!.id,
        req.body,
        module as ReadingModule
      )

      return res.json(success({ readingId, result }, 'Xem bói thành công'))
    } catch (err) { next(err) }
  },

  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query as { page?: string; limit?: string })
      const module = req.query.module as ReadingModule | undefined

      if (module && !VALID_MODULES.includes(module)) {
        return next(createError('INVALID_MODULE', 'Module không hợp lệ', 400))
      }

      const { rows, total } = await ReadingService.getHistory(req.user!.id, { module, page, limit })
      return res.json(paginated(rows, total, page, limit))
    } catch (err) { next(err) }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id)
      const reading = await ReadingModel.findByIdAndUser(id, req.user!.id)
      if (!reading) return next(createError('NOT_FOUND', 'Không tìm thấy kết quả xem bói', 404))
      return res.json(success(reading))
    } catch (err) { next(err) }
  },
}
