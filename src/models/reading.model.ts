import pool from '@/config/database'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import type { ReadingRow, ReadingModule } from '@/types/reading.types'

interface ReadingRowPacket extends ReadingRow, RowDataPacket {}
interface CountPacket extends RowDataPacket { total: number }

export const ReadingModel = {
  async create(data: {
    user_id?: number | null
    session_id?: string | null
    ip_address?: string | null
    module: ReadingModule
    input_data: string
    result_data?: string | null
    ai_model_id?: number | null
    tokens_used?: number
    is_free?: boolean
    credits_used?: number
  }): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO readings
         (user_id, session_id, ip_address, module, input_data, result_data,
          ai_model_id, tokens_used, is_free, credits_used)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.user_id ?? null,
        data.session_id ?? null,
        data.ip_address ?? null,
        data.module,
        data.input_data,
        data.result_data ?? null,
        data.ai_model_id ?? null,
        data.tokens_used ?? 0,
        data.is_free ? 1 : 0,
        data.credits_used ?? 0,
      ]
    )
    return result.insertId
  },

  async findById(id: number): Promise<ReadingRow | null> {
    const [rows] = await pool.query<ReadingRowPacket[]>(
      'SELECT * FROM readings WHERE id = ? LIMIT 1',
      [id]
    )
    return rows[0] ?? null
  },

  async findByIdAndUser(id: number, userId: number): Promise<ReadingRow | null> {
    const [rows] = await pool.query<ReadingRowPacket[]>(
      'SELECT * FROM readings WHERE id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    )
    return rows[0] ?? null
  },

  async findAll(opts: {
    userId?: number
    module?: ReadingModule
    isFree?: boolean
    page: number
    limit: number
  }): Promise<{ rows: ReadingRow[]; total: number }> {
    const conditions: string[] = []
    const params: unknown[] = []

    if (opts.userId !== undefined) {
      conditions.push('user_id = ?')
      params.push(opts.userId)
    }
    if (opts.module !== undefined) {
      conditions.push('module = ?')
      params.push(opts.module)
    }
    if (opts.isFree !== undefined) {
      conditions.push('is_free = ?')
      params.push(opts.isFree ? 1 : 0)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (opts.page - 1) * opts.limit

    const [[countRow]] = await pool.query<CountPacket[]>(
      `SELECT COUNT(*) AS total FROM readings ${where}`,
      params
    )

    const [rows] = await pool.query<ReadingRowPacket[]>(
      `SELECT * FROM readings ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, opts.limit, offset]
    )

    return { rows, total: countRow?.total ?? 0 }
  },
}
