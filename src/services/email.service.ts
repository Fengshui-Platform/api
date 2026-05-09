import nodemailer from 'nodemailer'
import { logger } from '@/utils/logger'

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

const FROM = process.env.EMAIL_FROM ?? 'Phong Thuy AI <noreply@phongthuyai.vn>'
const APP_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'

export const EmailService = {
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const link = `${APP_URL}/verify-email?token=${token}`

    try {
      await createTransport().sendMail({
        from: FROM,
        to: email,
        subject: 'Xác thực tài khoản Phong Thuy AI',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
            <h2 style="color:#7c3aed">Xác thực tài khoản</h2>
            <p>Cảm ơn bạn đã đăng ký. Nhấn vào nút bên dưới để xác thực email:</p>
            <a href="${link}"
               style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;
                      border-radius:8px;text-decoration:none;font-weight:bold">
              Xác thực ngay
            </a>
            <p style="margin-top:16px;color:#666;font-size:14px">
              Link có hiệu lực trong 24 giờ.<br>
              Nếu bạn không đăng ký tài khoản, hãy bỏ qua email này.
            </p>
          </div>
        `,
      })
    } catch (err) {
      logger.error('[EMAIL] sendVerificationEmail failed:', err)
      throw err
    }
  },

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const link = `${APP_URL}/reset-password?token=${token}`

    try {
      await createTransport().sendMail({
        from: FROM,
        to: email,
        subject: 'Đặt lại mật khẩu Phong Thuy AI',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
            <h2 style="color:#7c3aed">Đặt lại mật khẩu</h2>
            <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
            <a href="${link}"
               style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;
                      border-radius:8px;text-decoration:none;font-weight:bold">
              Đặt lại mật khẩu
            </a>
            <p style="margin-top:16px;color:#666;font-size:14px">
              Link có hiệu lực trong 1 giờ.<br>
              Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.
            </p>
          </div>
        `,
      })
    } catch (err) {
      logger.error('[EMAIL] sendPasswordResetEmail failed:', err)
      throw err
    }
  },
}
