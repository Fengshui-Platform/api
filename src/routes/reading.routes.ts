import { Router } from 'express'
import { ReadingController } from '@/controllers/reading.controller'
import { verifyToken, optionalToken } from '@/middleware/auth.middleware'
import { requireCredits } from '@/middleware/checkCredits'
import { freeReadingRateLimit, apiRateLimit } from '@/middleware/rateLimit'
import { validate, readingInputSchema } from '@/middleware/validate'

const router = Router()

// Free reading (no auth, IP rate limited)
router.post(
  '/free/:module',
  freeReadingRateLimit,
  optionalToken,
  validate(readingInputSchema),
  ReadingController.freeReading
)

// Paid reading (auth + credits required)
router.post(
  '/paid/:module',
  apiRateLimit,
  verifyToken,
  requireCredits,
  validate(readingInputSchema),
  ReadingController.paidReading
)

// History (authenticated)
router.get('/history', verifyToken, ReadingController.getHistory)
router.get('/:id', verifyToken, ReadingController.getById)

export default router
