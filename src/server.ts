import 'dotenv/config'
import app from '@/app'
import { logger } from '@/utils/logger'

const PORT = Number(process.env.PORT) || 3000

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} [${process.env.NODE_ENV}]`)
})

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason)
})

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err)
  process.exit(1)
})
