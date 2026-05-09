import { Router } from 'express'
import { AdminReadingController } from '@/controllers/admin/adminReading.controller'

const router = Router()

router.get('/', AdminReadingController.list)

export default router
