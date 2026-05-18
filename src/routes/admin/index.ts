import { Router } from 'express'
import { verifyToken, requireAdmin } from '@/middleware/auth.middleware'
import userAdminRoutes from './user.admin.routes'
import aiAdminRoutes from './ai.admin.routes'
import packageAdminRoutes from './package.admin.routes'
import orderAdminRoutes from './order.admin.routes'
import settingAdminRoutes from './setting.admin.routes'
import statsAdminRoutes from './stats.admin.routes'
import readingAdminRoutes from './reading.admin.routes'
import trafficAdminRoutes from './traffic.admin.routes'

const router = Router()

// All admin routes require auth + admin role
router.use(verifyToken, requireAdmin)

router.use('/users', userAdminRoutes)
router.use('/ai-models', aiAdminRoutes)
router.use('/credit-packages', packageAdminRoutes)
router.use('/credit-orders', orderAdminRoutes)
router.use('/settings', settingAdminRoutes)
router.use('/stats', statsAdminRoutes)
router.use('/readings', readingAdminRoutes)
router.use('/traffic', trafficAdminRoutes)

export default router
