import pool from '@/config/database'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'
import type { CreditOrderRow, OrderStatus } from '@/types/subscription.types'

interface CreditOrderRowPacket extends CreditOrderRow, RowDataPacket {}
interface CountPacket extends RowDataPacket { total: number }

export const CreditOrderModel = {
  async create(data: {
    user_id: number
    package_id?: number | null
    credits: number
    amount: number
    topup_code: string
    qr_expires_at?: Date | null
  }): Promise<CreditOrderRow> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO credit_orders
         (user_id, package_id, credits, amount, topup_code, status, retry_count, qr_expires_at)
       VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)`,
      [
        data.user_id,
        data.package_id ?? null,
        data.credits,
        data.amount,
        data.topup_code,
        data.qr_expires_at ?? null,
      ]
    )
    const row = await this.findById(result.insertId)
    if (!row) throw new Error('Failed to retrieve created credit order')
    return row
  },

  async findById(id: number): Promise<CreditOrderRow | null> {
    const [rows] = await pool.query<CreditOrderRowPacket[]>(
      'SELECT * FROM credit_orders WHERE id = ? LIMIT 1',
      [id]
    )
    return rows[0] ?? null
  },

  async findByIdAndUser(id: number, userId: number): Promise<CreditOrderRow | null> {
    const [rows] = await pool.query<CreditOrderRowPacket[]>(
      'SELECT * FROM credit_orders WHERE id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    )
    return rows[0] ?? null
  },

  async findPendingByTopupCode(topupCode: string): Promise<CreditOrderRow | null> {
    const [rows] = await pool.query<CreditOrderRowPacket[]>(
      `SELECT * FROM credit_orders
       WHERE topup_code = ? AND status = 'pending'
       LIMIT 1`,
      [topupCode]
    )
    return rows[0] ?? null
  },

  async update(id: number, data: Partial<Pick<CreditOrderRow,
    'status' | 'web2m_transaction_id' | 'paid_at' | 'qr_expires_at'
  >>): Promise<void> {
    const fields = Object.keys(data) as (keyof typeof data)[]
    if (fields.length === 0) return

    const setClauses = fields.map(f => `\`${f}\` = ?`).join(', ')
    const values: unknown[] = fields.map(f => data[f])
    values.push(id)

    await pool.query<ResultSetHeader>(
      `UPDATE credit_orders SET ${setClauses}, updated_at = NOW() WHERE id = ?`,
      values
    )
  },

  async incrementRetry(id: number): Promise<void> {
    await pool.query<ResultSetHeader>(
      'UPDATE credit_orders SET retry_count = retry_count + 1, updated_at = NOW() WHERE id = ?',
      [id]
    )
  },

  async findAll(opts: {
    userId?: number
    status?: OrderStatus
    page: number
    limit: number
  }): Promise<{ rows: CreditOrderRow[]; total: number }> {
    const conditions: string[] = []
    const params: unknown[] = []

    if (opts.userId !== undefined) {
      conditions.push('user_id = ?')
      params.push(opts.userId)
    }
    if (opts.status !== undefined) {
      conditions.push('status = ?')
      params.push(opts.status)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (opts.page - 1) * opts.limit

    const [[countRow]] = await pool.query<CountPacket[]>(
      `SELECT COUNT(*) AS total FROM credit_orders ${where}`,
      params
    )

    const [rows] = await pool.query<CreditOrderRowPacket[]>(
      `SELECT * FROM credit_orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, opts.limit, offset]
    )

    return { rows, total: countRow?.total ?? 0 }
  },
}
