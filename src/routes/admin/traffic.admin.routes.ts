import { Router } from 'express'
import { AdminTrafficController } from '@/controllers/admin/adminTraffic.controller'

const router = Router()

router.get('/overview',  AdminTrafficController.overview)
router.get('/daily',     AdminTrafficController.daily)
router.get('/pages',     AdminTrafficController.pages)
router.get('/features',  AdminTrafficController.features)
router.get('/funnel',    AdminTrafficController.funnel)
router.get('/retention', AdminTrafficController.retention)

export default router
