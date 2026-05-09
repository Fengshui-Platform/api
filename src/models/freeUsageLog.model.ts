import pool from '@/config/database'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

interface CountPacket extends RowDataPacket { total: number }

export const FreeUsageLogModel = {
  async countByIpToday(ip: string): Promise<number> {
    const [[row]] = await pool.query<CountPacket[]>(
      `SELECT COUNT(*) AS total FROM free_usage_logs
       WHERE ip_address = ? AND DATE(created_at) = CURDATE()`,
      [ip]
    )
    return row?.total ?? 0
  },

  async log(ip: string, sessionId?: string | null): Promise<void> {
    await pool.query<ResultSetHeader>(
      'INSERT INTO free_usage_logs (ip_address, session_id) VALUES (?, ?)',
      [ip, sessionId ?? null]
    )
  },
}
