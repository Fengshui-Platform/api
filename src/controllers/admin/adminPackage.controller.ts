import type { Request, Response, NextFunction } from 'express'
import { CreditPackageModel } from '@/models/creditPackage.model'
import { success, createError } from '@/utils/response'

export const AdminPackageController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const packages = await CreditPackageModel.findAll()
      return res.json(success(packages))
    } catch (err) { next(err) }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, credits, price, validity_days, description, sort_order } = req.body as {
        name: string
        credits: number
        price: number
        validity_days?: number
        description?: string
        sort_order?: number
      }

      if (!name || credits <= 0 || price <= 0) {
        return next(createError('INVALID_DATA', 'Thông tin gói credits không hợp lệ', 422))
      }

      const id = await CreditPackageModel.create({ name, credits, price, validity_days, description, sort_order })
      const pkg = await CreditPackageModel.findById(id)
      return res.status(201).json(success(pkg, 'Tạo gói credits thành công'))
    } catch (err) { next(err) }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id)
      const pkg = await CreditPackageModel.findById(id)
      if (!pkg) return next(createError('NOT_FOUND', 'Gói credits không tồn tại', 404))

      const { name, credits, price, validity_days, description, is_active, sort_order } = req.body as {
        name?: string
        credits?: number
        price?: number
        validity_days?: number
        description?: string
        is_active?: boolean
        sort_order?: number
      }

      await CreditPackageModel.update(id, { name, credits, price, validity_days, description, is_active, sort_order })
      const updated = await CreditPackageModel.findById(id)
      return res.json(success(updated, 'Cập nhật gói credits thành công'))
    } catch (err) { next(err) }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id)
      const pkg = await CreditPackageModel.findById(id)
      if (!pkg) return next(createError('NOT_FOUND', 'Gói credits không tồn tại', 404))

      await CreditPackageModel.delete(id)
      return res.json(success(null, 'Đã xóa gói credits'))
    } catch (err) { next(err) }
  },
}
