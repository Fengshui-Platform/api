import type { Request, Response, NextFunction } from 'express'
import { PromptModel } from '@/models/prompt.model'
import { success, createError } from '@/utils/response'
import type { ReadingModule, PromptTier } from '@/types/reading.types'

export const AdminPromptController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const module = req.query.module as ReadingModule | undefined
      const prompts = await PromptModel.findAll(module ? { module } : undefined)
      return res.json(success(prompts))
    } catch (err) { next(err) }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id)
      const prompt = await PromptModel.findById(id)
      if (!prompt) return next(createError('NOT_FOUND', 'Prompt không tồn tại', 404))
      return res.json(success(prompt))
    } catch (err) { next(err) }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { module, tier, system_prompt, user_template } = req.body as {
        module: ReadingModule
        tier: PromptTier
        system_prompt: string
        user_template: string
      }

      const id = await PromptModel.create({ module, tier, system_prompt, user_template })
      const prompt = await PromptModel.findById(id)
      return res.status(201).json(success(prompt, 'Tạo prompt thành công'))
    } catch (err) { next(err) }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id)
      const prompt = await PromptModel.findById(id)
      if (!prompt) return next(createError('NOT_FOUND', 'Prompt không tồn tại', 404))

      const { system_prompt, user_template, is_active } = req.body as {
        system_prompt?: string
        user_template?: string
        is_active?: boolean
      }

      await PromptModel.update(id, { system_prompt, user_template, is_active })
      const updated = await PromptModel.findById(id)
      return res.json(success(updated, 'Cập nhật prompt thành công'))
    } catch (err) { next(err) }
  },

  async deactivate(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id)
      const prompt = await PromptModel.findById(id)
      if (!prompt) return next(createError('NOT_FOUND', 'Prompt không tồn tại', 404))

      await PromptModel.deactivate(id)
      return res.json(success(null, 'Đã vô hiệu hóa prompt'))
    } catch (err) { next(err) }
  },
}
