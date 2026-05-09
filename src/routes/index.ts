import { Router } from 'express'
import authRoutes from './auth.routes'
import readingRoutes from './reading.routes'
import userRoutes from './user.routes'
import creditRoutes from './credit.routes'
import adminRoutes from './admin'

const router = Router()

router.use('/auth', authRoutes)
router.use('/readings', readingRoutes)
router.use('/users', userRoutes)
router.use('/credits', creditRoutes)
router.use('/admin', adminRoutes)

export default router
