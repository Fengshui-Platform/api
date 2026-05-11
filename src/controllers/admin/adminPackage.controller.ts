import type { Request, Response, NextFunction } from 'express'
import { CreditPackageModel } from '@/models/creditPackage.model'
import { success, createError } from '@/utils/response'

export const AdminPackageController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const packages = await CreditPackageModel.findAll({ includeInactive: true })
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
        is_active?: number | boolean
        sort_order?: number
      }

      const updates: Parameters<typeof CreditPackageModel.update>[1] = {}
      if (name !== undefined)          updates.name = name
      if (credits !== undefined)       updates.credits = Number(credits)
      if (price !== undefined)         updates.price = Number(price)
      if (validity_days !== undefined) updates.validity_days = Number(validity_days)
      if (description !== undefined)   updates.description = description
      if (is_active !== undefined)     updates.is_active = Boolean(Number(is_active))
      if (sort_order !== undefined)    updates.sort_order = Number(sort_order)

      await CreditPackageModel.update(id, updates)
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
