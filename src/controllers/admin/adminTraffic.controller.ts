import type { Request, Response, NextFunction } from 'express'
import pool from '@/config/database'
import type { RowDataPacket } from 'mysql2'
import { success } from '@/utils/response'

interface StatRow extends RowDataPacket { value: number }
interface DailyTrafficRow extends RowDataPacket {
  date: string
  total_views: number
  unique_sessions: number
  logged_in_users: number
}
interface PageRow extends RowDataPacket { page: string; views: number }
interface EventRow extends RowDataPacket { event_type: string; module: string | null; count: number }
interface FunnelStep { step: string; count: number; pct: number }
interface RetentionRow extends RowDataPacket { date: string; returning: number }

function parseDateRange(req: Request): { from: string; to: string } {
  const defaultTo = new Date()
  const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const from = typeof req.query.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from)
    ? req.query.from
    : defaultFrom.toISOString().slice(0, 10)

  const to = typeof req.query.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)
    ? req.query.to
    : defaultTo.toISOString().slice(0, 10)

  return { from, to }
}

export const AdminTrafficController = {
  async overview(req: Request, res: Response, next: NextFunction) {
    try {
      const { from, to } = parseDateRange(req)
      const toEnd = `${to} 23:59:59`

      const [[totalViews]] = await pool.query<StatRow[]>(
        `SELECT COUNT(*) AS value FROM page_view_logs WHERE created_at BETWEEN ? AND ?`,
        [from, toEnd]
      )
      const [[uniqueSessions]] = await pool.query<StatRow[]>(
        `SELECT COUNT(DISTINCT session_id) AS value FROM page_view_logs WHERE created_at BETWEEN ? AND ?`,
        [from, toEnd]
      )
      const [[loggedInUsers]] = await pool.query<StatRow[]>(
        `SELECT COUNT(DISTINCT user_id) AS value FROM page_view_logs
         WHERE user_id IS NOT NULL AND created_at BETWEEN ? AND ?`,
        [from, toEnd]
      )
      const [[totalEvents]] = await pool.query<StatRow[]>(
        `SELECT COUNT(*) AS value FROM feature_events WHERE created_at BETWEEN ? AND ?`,
        [from, toEnd]
      )
      const [[readingStarts]] = await pool.query<StatRow[]>(
        `SELECT COUNT(*) AS value FROM feature_events
         WHERE event_type = 'reading_start' AND created_at BETWEEN ? AND ?`,
        [from, toEnd]
      )
      const [[buyInitiations]] = await pool.query<StatRow[]>(
        `SELECT COUNT(*) AS value FROM feature_events
         WHERE event_type = 'buy_credit_init' AND created_at BETWEEN ? AND ?`,
        [from, toEnd]
      )

      const totalV = totalViews?.value ?? 0
      const uniqueS = uniqueSessions?.value ?? 0
      const loggedIn = loggedInUsers?.value ?? 0

      return res.json(success({
        total_views:       totalV,
        unique_sessions:   uniqueS,
        logged_in_users:   loggedIn,
        login_rate:        uniqueS > 0 ? parseFloat((loggedIn / uniqueS * 100).toFixed(1)) : 0,
        total_events:      totalEvents?.value ?? 0,
        reading_starts:    readingStarts?.value ?? 0,
        buy_initiations:   buyInitiations?.value ?? 0,
        period:            { from, to },
      }))
    } catch (err) { next(err) }
  },

  async daily(req: Request, res: Response, next: NextFunction) {
    try {
      const { from, to } = parseDateRange(req)
      const toEnd = `${to} 23:59:59`

      const [rows] = await pool.query<DailyTrafficRow[]>(
        `SELECT
           DATE(created_at)              AS date,
           COUNT(*)                      AS total_views,
           COUNT(DISTINCT session_id)    AS unique_sessions,
           COUNT(DISTINCT user_id)       AS logged_in_users
         FROM page_view_logs
         WHERE created_at BETWEEN ? AND ?
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [from, toEnd]
      )

      return res.json(success(rows))
    } catch (err) { next(err) }
  },

  async pages(req: Request, res: Response, next: NextFunction) {
    try {
      const { from, to } = parseDateRange(req)
      const toEnd = `${to} 23:59:59`
      const limit = Math.min(20, Math.max(5, Number(req.query.limit) || 10))

      const [rows] = await pool.query<PageRow[]>(
        `SELECT page, COUNT(*) AS views
         FROM page_view_logs
         WHERE created_at BETWEEN ? AND ?
         GROUP BY page
         ORDER BY views DESC
         LIMIT ?`,
        [from, toEnd, limit]
      )

      return res.json(success(rows))
    } catch (err) { next(err) }
  },

  async features(req: Request, res: Response, next: NextFunction) {
    try {
      const { from, to } = parseDateRange(req)
      const toEnd = `${to} 23:59:59`

      const [rows] = await pool.query<EventRow[]>(
        `SELECT event_type, module, COUNT(*) AS count
         FROM feature_events
         WHERE created_at BETWEEN ? AND ?
         GROUP BY event_type, module
         ORDER BY count DESC`,
        [from, toEnd]
      )

      return res.json(success(rows))
    } catch (err) { next(err) }
  },

  async funnel(req: Request, res: Response, next: NextFunction) {
    try {
      const { from, to } = parseDateRange(req)
      const toEnd = `${to} 23:59:59`

      const [[visits]] = await pool.query<StatRow[]>(
        `SELECT COUNT(DISTINCT session_id) AS value FROM page_view_logs WHERE created_at BETWEEN ? AND ?`,
        [from, toEnd]
      )
      const [[registers]] = await pool.query<StatRow[]>(
        `SELECT COUNT(*) AS value FROM feature_events
         WHERE event_type = 'register_success' AND created_at BETWEEN ? AND ?`,
        [from, toEnd]
      )
      const [[firstReadings]] = await pool.query<StatRow[]>(
        `SELECT COUNT(*) AS value FROM feature_events
         WHERE event_type = 'reading_start' AND created_at BETWEEN ? AND ?`,
        [from, toEnd]
      )
      const [[buyInits]] = await pool.query<StatRow[]>(
        `SELECT COUNT(*) AS value FROM feature_events
         WHERE event_type = 'buy_credit_init' AND created_at BETWEEN ? AND ?`,
        [from, toEnd]
      )

      const v = visits?.value ?? 0
      const r = registers?.value ?? 0
      const fr = firstReadings?.value ?? 0
      const b = buyInits?.value ?? 0

      const pct = (n: number) => v > 0 ? parseFloat((n / v * 100).toFixed(1)) : 0
      const steps: FunnelStep[] = [
        { step: 'Khách truy cập',         count: v,  pct: 100    },
        { step: 'Đăng ký tài khoản',      count: r,  pct: pct(r) },
        { step: 'Dùng tính năng đọc bài', count: fr, pct: pct(fr) },
        { step: 'Khởi tạo mua credit',    count: b,  pct: pct(b)  },
      ]

      return res.json(success({ steps, period: { from, to } }))
    } catch (err) { next(err) }
  },

  async retention(req: Request, res: Response, next: NextFunction) {
    try {
      const { from, to } = parseDateRange(req)
      const toEnd = `${to} 23:59:59`

      // Returning = session appeared on more than 1 distinct calendar day in the period
      const [rows] = await pool.query<RetentionRow[]>(
        `SELECT DATE(created_at) AS date,
                COUNT(DISTINCT session_id) AS returning
         FROM page_view_logs
         WHERE created_at BETWEEN ? AND ?
           AND session_id IN (
             SELECT session_id
             FROM page_view_logs
             WHERE created_at BETWEEN ? AND ?
             GROUP BY session_id
             HAVING COUNT(DISTINCT DATE(created_at)) > 1
           )
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [from, toEnd, from, toEnd]
      )

      return res.json(success(rows))
    } catch (err) { next(err) }
  },
}
