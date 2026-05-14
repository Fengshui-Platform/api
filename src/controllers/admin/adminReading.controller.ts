import type { Request, Response, NextFunction } from 'express'
import pool from '@/config/database'
import type { RowDataPacket } from 'mysql2'
import { paginated, createError } from '@/utils/response'
import { parsePagination } from '@/types/api.types'
import type { ReadingModule } from '@/types/reading.types'

interface AdminReadingRow extends RowDataPacket {
  id: number
  user_id: number | null
  session_id: string | null
  ip_address: string | null
  module: string
  is_free: number
  credits_used: number
  input_data: string
  result_data: string
  ai_model_id: number | null
  tokens_used: number
  created_at: string
  full_name: string | null
  email: string | null
}

interface CountRow extends RowDataPacket { total: number }

const VALID_MODULES: ReadingModule[] = ['numerology', 'love', 'finance', 'sim', 'fengshui_home', 'horoscope', 'zodiac']

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
        return next(createError('INVALID_MODULE', 'Module không hợp lệ', 400))
      }

      const conditions: string[] = []
      const params: unknown[] = []

      if (userId !== undefined) {
        conditions.push('r.user_id = ?')
        params.push(userId)
      }
      if (module !== undefined) {
        conditions.push('r.module = ?')
        params.push(module)
      }
      if (isFree !== undefined) {
        conditions.push('r.is_free = ?')
        params.push(isFree ? 1 : 0)
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
      const offset = (page - 1) * limit

      const [[countRow]] = await pool.query<CountRow[]>(
        `SELECT COUNT(*) AS total FROM readings r ${where}`,
        params
      )

      const [rows] = await pool.query<AdminReadingRow[]>(
        `SELECT r.id, r.user_id, r.session_id, r.ip_address, r.module,
                r.is_free, r.credits_used, r.input_data, r.result_data,
                r.ai_model_id, r.tokens_used, r.created_at,
                u.full_name, u.email
         FROM readings r
         LEFT JOIN users u ON u.id = r.user_id
         ${where}
         ORDER BY r.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      )

      return res.json(paginated(rows, countRow?.total ?? 0, page, limit))
    } catch (err) { next(err) }
  },
}
