import type { Request, Response, NextFunction } from 'express'
import pool from '@/config/database'
import type { RowDataPacket } from 'mysql2'
import { success } from '@/utils/response'

interface StatRow extends RowDataPacket { value: number }
interface DailyRow extends RowDataPacket { date: string; count: number; revenue: number }
interface ModuleRow extends RowDataPacket { module: string; count: number }

export const AdminStatsController = {
  async overview(_req: Request, res: Response, next: NextFunction) {
    try {
      const [[totalUsers]] = await pool.query<StatRow[]>(
        'SELECT COUNT(*) AS value FROM users'
      )
      const [[activeUsers]] = await pool.query<StatRow[]>(
        'SELECT COUNT(*) AS value FROM users WHERE is_active = 1'
      )
      const [[totalReadings]] = await pool.query<StatRow[]>(
        'SELECT COUNT(*) AS value FROM readings'
      )
      const [[todayReadings]] = await pool.query<StatRow[]>(
        "SELECT COUNT(*) AS value FROM readings WHERE DATE(created_at) = CURDATE()"
      )
      const [[totalRevenue]] = await pool.query<StatRow[]>(
        "SELECT COALESCE(SUM(amount), 0) AS value FROM credit_orders WHERE status = 'paid'"
      )
      const [[monthRevenue]] = await pool.query<StatRow[]>(
        `SELECT COALESCE(SUM(amount), 0) AS value FROM credit_orders
         WHERE status = 'paid' AND YEAR(paid_at) = YEAR(NOW()) AND MONTH(paid_at) = MONTH(NOW())`
      )
      const [[pendingOrders]] = await pool.query<StatRow[]>(
        "SELECT COUNT(*) AS value FROM credit_orders WHERE status = 'pending'"
      )

      return res.json(success({
        total_users: totalUsers?.value ?? 0,
        active_users: activeUsers?.value ?? 0,
        total_readings: totalReadings?.value ?? 0,
        today_readings: todayReadings?.value ?? 0,
        total_revenue: totalRevenue?.value ?? 0,
        month_revenue: monthRevenue?.value ?? 0,
        pending_orders: pendingOrders?.value ?? 0,
      }))
    } catch (err) { next(err) }
  },

  async dailyStats(req: Request, res: Response, next: NextFunction) {
    try {
      const days = Math.min(90, Math.max(1, Number(req.query.days) || 30))

      const [dailyReadings] = await pool.query<DailyRow[]>(
        `SELECT DATE(created_at) AS date, COUNT(*) AS count, 0 AS revenue
         FROM readings
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [days]
      )

      const [dailyRevenue] = await pool.query<DailyRow[]>(
        `SELECT DATE(paid_at) AS date, COUNT(*) AS count, SUM(amount) AS revenue
         FROM credit_orders
         WHERE status = 'paid' AND paid_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY DATE(paid_at)
         ORDER BY date ASC`,
        [days]
      )

      return res.json(success({ readings: dailyReadings, revenue: dailyRevenue }))
    } catch (err) { next(err) }
  },

  async moduleStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const [rows] = await pool.query<ModuleRow[]>(
        `SELECT module, COUNT(*) AS count
         FROM readings
         GROUP BY module
         ORDER BY count DESC`
      )
      return res.json(success(rows))
    } catch (err) { next(err) }
  },
}
