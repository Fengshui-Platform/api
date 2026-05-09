import { Router } from 'express'
import { AdminStatsController } from '@/controllers/admin/adminStats.controller'

const router = Router()

router.get('/overview', AdminStatsController.overview)
router.get('/daily', AdminStatsController.dailyStats)
router.get('/modules', AdminStatsController.moduleStats)

export default router
