import type { Request, Response, NextFunction } from 'express'
import pool from '@/config/database'
import type { RowDataPacket } from 'mysql2'
import { CreditOrderModel } from '@/models/creditOrder.model'
import { PaymentService } from '@/services/payment.service'
import { success, paginated, createError } from '@/utils/response'
import { parsePagination } from '@/types/api.types'
import type { OrderStatus } from '@/types/subscription.types'

interface OrderWithUserPacket extends RowDataPacket {
  id: number
  user_id: number
  package_id: number | null
  credits: number
  amount: string
  topup_code: string
  status: string
  retry_count: number
  qr_expires_at: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
  full_name: string | null
  email: string | null
  package_name: string | null
}

interface CountPacket extends RowDataPacket { total: number }

export const AdminOrderController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query as { page?: string; limit?: string })
      const userId = req.query.user_id ? Number(req.query.user_id) : undefined
      const status = req.query.status as OrderStatus | undefined

      const conditions: string[] = []
      const params: unknown[] = []
      if (userId !== undefined) { conditions.push('o.user_id = ?'); params.push(userId) }
      if (status !== undefined) { conditions.push('o.status = ?'); params.push(status) }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
      const offset = (page - 1) * limit

      const [[countRow]] = await pool.query<CountPacket[]>(
        `SELECT COUNT(*) AS total FROM credit_orders o ${where}`,
        params
      )

      const [rows] = await pool.query<OrderWithUserPacket[]>(
        `SELECT o.*,
                u.full_name, u.email,
                cp.name AS package_name
         FROM credit_orders o
         LEFT JOIN users u ON u.id = o.user_id
         LEFT JOIN credit_packages cp ON cp.id = o.package_id
         ${where}
         ORDER BY o.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      )

      return res.json(paginated(rows, countRow?.total ?? 0, page, limit))
    } catch (err) { next(err) }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id)
      const order = await CreditOrderModel.findById(id)
      if (!order) return next(createError('NOT_FOUND', 'Đơn hàng không tồn tại', 404))
      return res.json(success(order))
    } catch (err) { next(err) }
  },

  async manualFulfill(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id)
      const order = await CreditOrderModel.findById(id)
      if (!order) return next(createError('NOT_FOUND', 'Đơn hàng không tồn tại', 404))

      if (order.status === 'paid') {
        return next(createError('ALREADY_PAID', 'Đơn hàng đã được thanh toán', 400))
      }

      const { transaction_id } = req.body as { transaction_id?: string }
      await PaymentService.fulfillOrder(order, transaction_id ?? `MANUAL_${Date.now()}`)

      const updated = await CreditOrderModel.findById(id)
      return res.json(success(updated, 'Xác nhận thanh toán thành công'))
    } catch (err) { next(err) }
  },

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id)
      const order = await CreditOrderModel.findById(id)
      if (!order) return next(createError('NOT_FOUND', 'Đơn hàng không tồn tại', 404))

      if (order.status !== 'pending') {
        return next(createError('CANNOT_CANCEL', 'Chỉ có thể hủy đơn hàng đang chờ thanh toán', 400))
      }

      await CreditOrderModel.update(id, { status: 'failed' })
      return res.json(success(null, 'Đã hủy đơn hàng'))
    } catch (err) { next(err) }
  },
}
