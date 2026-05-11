import type { Request, Response, NextFunction } from 'express'
import pool from '@/config/database'
import type { RowDataPacket } from 'mysql2'
import { success } from '@/utils/response'

interface StatRow extends RowDataPacket { value: number }
interface DailyRow extends RowDataPacket { date: string; count: number; revenue: number }
interface ModuleRow extends RowDataPacket { module: string; count: number }
interface MonthlyRow extends RowDataPacket { month: string; revenue: number; orders: number; readings: number; new_users: number }

export const AdminStatsController = {
  async overview(_req: Request, res: Response, next: NextFunction) {
    try {
      const [[totalUsers]] = await pool.query<StatRow[]>('SELECT COUNT(*) AS value FROM users')
      const [[newUsers7d]] = await pool.query<StatRow[]>(
        'SELECT COUNT(*) AS value FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'
      )
      const [[newUsers30d]] = await pool.query<StatRow[]>(
        'SELECT COUNT(*) AS value FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
      )
      const [[totalReadings]] = await pool.query<StatRow[]>('SELECT COUNT(*) AS value FROM readings')
      const [[readingsToday]] = await pool.query<StatRow[]>(
        "SELECT COUNT(*) AS value FROM readings WHERE DATE(created_at) = CURDATE()"
      )
      const [[totalRevenue]] = await pool.query<StatRow[]>(
        "SELECT COALESCE(SUM(amount), 0) AS value FROM credit_orders WHERE status = 'paid'"
      )
      const [[revenueThisMonth]] = await pool.query<StatRow[]>(
        `SELECT COALESCE(SUM(amount), 0) AS value FROM credit_orders
         WHERE status = 'paid' AND YEAR(paid_at) = YEAR(NOW()) AND MONTH(paid_at) = MONTH(NOW())`
      )
      const [[pendingOrders]] = await pool.query<StatRow[]>(
        "SELECT COUNT(*) AS value FROM credit_orders WHERE status = 'pending'"
      )

      return res.json(success({
        total_users:        totalUsers?.value ?? 0,
        new_users_7d:       newUsers7d?.value ?? 0,
        new_users_30d:      newUsers30d?.value ?? 0,
        total_readings:     totalReadings?.value ?? 0,
        readings_today:     readingsToday?.value ?? 0,
        total_revenue:      totalRevenue?.value ?? 0,
        revenue_this_month: revenueThisMonth?.value ?? 0,
        pending_orders:     pendingOrders?.value ?? 0,
      }))
    } catch (err) { next(err) }
  },

  async dailyStats(req: Request, res: Response, next: NextFunction) {
    try {
      const days = Math.min(90, Math.max(7, Number(req.query.days) || 30))

      const [dailyReadings] = await pool.query<DailyRow[]>(
        `SELECT DATE(created_at) AS date, COUNT(*) AS count, 0 AS revenue
         FROM readings
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [days]
      )

      const [dailyRevenue] = await pool.query<DailyRow[]>(
        `SELECT DATE(paid_at) AS date, 0 AS count, COALESCE(SUM(amount), 0) AS revenue
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

  async usersDaily(req: Request, res: Response, next: NextFunction) {
    try {
      const days = Math.min(90, Math.max(7, Number(req.query.days) || 30))

      const [rows] = await pool.query<(RowDataPacket & { date: string; count: number })[]>(
        `SELECT DATE(created_at) AS date, COUNT(*) AS count
         FROM users
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [days]
      )
      return res.json(success(rows))
    } catch (err) { next(err) }
  },

  async monthlyStats(req: Request, res: Response, next: NextFunction) {
    try {
      const months = Math.min(24, Math.max(3, Number(req.query.months) || 12))

      const [rows] = await pool.query<MonthlyRow[]>(
        `SELECT
           DATE_FORMAT(m.month_start, '%Y-%m') AS month,
           COALESCE(r.readings, 0)            AS readings,
           COALESCE(o.revenue, 0)             AS revenue,
           COALESCE(o.orders, 0)              AS orders,
           COALESCE(u.new_users, 0)           AS new_users
         FROM (
           SELECT DATE_FORMAT(DATE_SUB(NOW(), INTERVAL n MONTH), '%Y-%m-01') AS month_start
           FROM (
             SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3
             UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7
             UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11
             UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15
             UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19
             UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23
           ) nums WHERE n < ?
         ) m
         LEFT JOIN (
           SELECT DATE_FORMAT(created_at, '%Y-%m-01') AS month_start, COUNT(*) AS readings
           FROM readings
           GROUP BY DATE_FORMAT(created_at, '%Y-%m-01')
         ) r ON r.month_start = m.month_start
         LEFT JOIN (
           SELECT DATE_FORMAT(paid_at, '%Y-%m-01') AS month_start,
                  COALESCE(SUM(amount), 0) AS revenue,
                  COUNT(*) AS orders
           FROM credit_orders WHERE status = 'paid'
           GROUP BY DATE_FORMAT(paid_at, '%Y-%m-01')
         ) o ON o.month_start = m.month_start
         LEFT JOIN (
           SELECT DATE_FORMAT(created_at, '%Y-%m-01') AS month_start, COUNT(*) AS new_users
           FROM users
           GROUP BY DATE_FORMAT(created_at, '%Y-%m-01')
         ) u ON u.month_start = m.month_start
         ORDER BY m.month_start ASC`,
        [months]
      )
      return res.json(success(rows))
    } catch (err) { next(err) }
  },
}
