import axios from 'axios'
import pool from '@/config/database'
import { WEB2M_CONFIG } from '@/config/web2m.config'
import { CreditOrderModel } from '@/models/creditOrder.model'
import { CreditPackageModel } from '@/models/creditPackage.model'
import { generateTopupCode } from '@/utils/generateCode'
import { createError } from '@/utils/response'
import { logger } from '@/utils/logger'
import type { CreditOrderRow } from '@/types/subscription.types'

const QR_TTL_MS = 10 * 60 * 1000 // 10 minutes
const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes max polling per request

interface Web2MTransaction {
  id: string
  description: string
  amount: number
  transactionDate: string
}

interface QrResponse {
  qrUrl: string
  qrDataURL: string
}

export const PaymentService = {
  async createOrder(userId: number, packageId: number): Promise<{
    order: CreditOrderRow
    qrUrl: string
    qrDataURL: string
  }> {
    const pkg = await CreditPackageModel.findById(packageId)
    if (!pkg || !pkg.is_active) {
      throw createError('PACKAGE_NOT_FOUND', 'Gói credits không tồn tại', 404)
    }

    const topupCode = generateTopupCode()
    const qrExpiresAt = new Date(Date.now() + QR_TTL_MS)

    const order = await CreditOrderModel.create({
      user_id: userId,
      package_id: packageId,
      credits: pkg.credits,
      amount: pkg.price,
      topup_code: topupCode,
      qr_expires_at: qrExpiresAt,
    })

    const { qrUrl, qrDataURL } = await PaymentService.generateQr(pkg.price, topupCode)

    return { order, qrUrl, qrDataURL }
  },

  async generateQr(amount: number, description: string): Promise<QrResponse> {
    const params = new URLSearchParams({
      bankName:       WEB2M_CONFIG.bankName,
      bankNumber:     WEB2M_CONFIG.bankNumber,
      bankUserName:   WEB2M_CONFIG.accountHolder,
      isMask:         WEB2M_CONFIG.isMask,
      bankBackground: WEB2M_CONFIG.bankBackground,
      token:          WEB2M_CONFIG.bankToken,
      amount:         String(amount),
      des:            description,
    })

    const url = `${WEB2M_CONFIG.apiGetQr}?${params.toString()}`
    const response = await axios.get<{ qrCode?: string; qrDataURL?: string; error?: string }>(url, {
      timeout: 10000,
    })

    if (response.data.error) {
      throw createError('QR_GEN_FAILED', `Không thể tạo mã QR: ${response.data.error}`, 502)
    }

    return {
      qrUrl: response.data.qrCode ?? url,
      qrDataURL: response.data.qrDataURL ?? '',
    }
  },

  async fetchTransactions(limit = 20): Promise<Web2MTransaction[]> {
    const params = new URLSearchParams({
      bankName:   WEB2M_CONFIG.bankName,
      bankNumber: WEB2M_CONFIG.bankNumber,
      token:      WEB2M_CONFIG.bankToken,
      ...(WEB2M_CONFIG.bankPassword ? { password: WEB2M_CONFIG.bankPassword } : {}),
      limit:      String(limit),
    })

    try {
      const response = await axios.get<{ transactions?: Web2MTransaction[]; error?: string }>(
        `${WEB2M_CONFIG.apiGetTransactionV2}?${params.toString()}`,
        { timeout: 10000 }
      )
      return response.data.transactions ?? []
    } catch (err) {
      logger.warn('Web2M transaction fetch failed:', err)
      return []
    }
  },

  async checkOrderPaid(orderId: number, userId: number): Promise<{
    paid: boolean
    order: CreditOrderRow
  }> {
    const order = await CreditOrderModel.findByIdAndUser(orderId, userId)
    if (!order) throw createError('ORDER_NOT_FOUND', 'Đơn hàng không tồn tại', 404)

    if (order.status === 'paid') return { paid: true, order }
    if (order.status === 'failed' || order.status === 'expired') {
      return { paid: false, order }
    }

    // Check QR expiry
    if (order.qr_expires_at && new Date(order.qr_expires_at) < new Date()) {
      await CreditOrderModel.update(order.id, { status: 'expired' })
      return { paid: false, order: { ...order, status: 'expired' } }
    }

    // Poll Web2M for matching transaction
    const transactions = await PaymentService.fetchTransactions(50)
    const match = transactions.find(tx =>
      tx.description.includes(order.topup_code) &&
      tx.amount >= order.amount
    )

    if (match) {
      await PaymentService.fulfillOrder(order, match.id)
      const updated = await CreditOrderModel.findById(order.id)
      return { paid: true, order: updated! }
    }

    await CreditOrderModel.incrementRetry(order.id)
    return { paid: false, order }
  },

  /**
   * Long-poll: call checkOrderPaid in a loop until paid or timeout.
   * Used by the polling endpoint that the frontend hits.
   */
  async pollUntilPaid(
    orderId: number,
    userId: number,
    timeoutMs = POLL_TIMEOUT_MS
  ): Promise<{ paid: boolean; order: CreditOrderRow }> {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      const result = await PaymentService.checkOrderPaid(orderId, userId)
      if (result.paid || result.order.status === 'expired' || result.order.status === 'failed') {
        return result
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
    }

    // Return current state without mutating
    const order = await CreditOrderModel.findByIdAndUser(orderId, userId)
    return { paid: false, order: order! }
  },

  async fulfillOrder(order: CreditOrderRow, transactionId: string): Promise<void> {
    // Calculate expiry: adds CREDIT_VALIDITY_DAYS from today
    const validityDays = Number(process.env.CREDIT_VALIDITY_DAYS) || 50
    const pkg = order.package_id ? await CreditPackageModel.findById(order.package_id) : null
    const days = pkg?.validity_days ?? validityDays

    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setDate(expiresAt.getDate() + days)

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      // Mark order paid
      await conn.query(
        `UPDATE credit_orders
         SET status = 'paid', web2m_transaction_id = ?, paid_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [transactionId, order.id]
      )

      // Credit the user (existing balance preserved, new expiry set)
      await conn.query(
        `UPDATE users
         SET credits_balance = credits_balance + ?,
             credits_expires_at = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [order.credits, expiresAt, order.user_id]
      )

      await conn.commit()
      logger.info(`Order ${order.id} fulfilled: +${order.credits} credits for user ${order.user_id}`)
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  },
}
