import type { Request, Response, NextFunction } from 'express'
import { createError } from '@/utils/response'
import type { CreditsStatus } from '@/types/user.types'

export function getCreditsStatus(balance: number, expiresAt: Date | null): CreditsStatus {
  if (balance <= 0) return 'empty'
  if (!expiresAt || new Date(expiresAt) < new Date()) return 'frozen'
  return 'active'
}

export function requireCredits(req: Request, _res: Response, next: NextFunction) {
  const user = req.user!
  const status = getCreditsStatus(user.credits_balance, user.credits_expires_at)

  if (status === 'empty') {
    return next(createError('NO_CREDITS', 'Bạn đã hết lượt. Mua thêm để tiếp tục.', 402))
  }
  if (status === 'frozen') {
    return next(createError(
      'CREDITS_FROZEN',
      `Lượt của bạn đang bị đóng băng (còn ${user.credits_balance} lượt). Mua thêm để giải băng.`,
      402
    ))
  }
  next()
}
