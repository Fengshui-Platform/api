import pool from '@/config/database'
import type { RowDataPacket, ResultSetHeader } from 'mysql2'

interface CountPacket extends RowDataPacket { total: number }

// Vietnam timezone offset
const TZ = '+07:00'

export const FreeUsageLogModel = {
  /**
   * Check whether this session/IP has already used their free reading today (VN midnight reset).
   * Priority: session_id first (each device is independent), fallback to IP.
   *
   * Two phones on the same WiFi each have their own session_id → not affected by each other.
   * Bots/scrapers without cookies fall back to IP-based check.
   */
  async hasUsedFreeToday(ip: string, sessionId?: string | null): Promise<boolean> {
    const todayExpr = `DATE(CONVERT_TZ(created_at, '+00:00', '${TZ}')) = DATE(CONVERT_TZ(NOW(), '+00:00', '${TZ}'))`

    if (sessionId) {
      const [[row]] = await pool.query<CountPacket[]>(
        `SELECT COUNT(*) AS total FROM free_usage_logs
         WHERE session_id = ? AND ${todayExpr}`,
        [sessionId]
      )
      return (row?.total ?? 0) >= 1
    }

    // No session cookie → fall back to IP
    const [[row]] = await pool.query<CountPacket[]>(
      `SELECT COUNT(*) AS total FROM free_usage_logs
       WHERE ip_address = ? AND ${todayExpr}`,
      [ip]
    )
    return (row?.total ?? 0) >= 1
  },

  async log(ip: string, sessionId?: string | null): Promise<void> {
    await pool.query<ResultSetHeader>(
      'INSERT INTO free_usage_logs (ip_address, session_id) VALUES (?, ?)',
      [ip, sessionId ?? null]
    )
  },
}
