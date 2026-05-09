import { Router } from 'express'
import { AdminUserController } from '@/controllers/admin/adminUser.controller'

const router = Router()

router.get('/', AdminUserController.list)
router.get('/:id', AdminUserController.getById)
router.put('/:id', AdminUserController.update)
router.delete('/:id', AdminUserController.delete)
router.post('/:id/credits', AdminUserController.adjustCredits)
router.post('/:id/reset-password', AdminUserController.resetPassword)

export default router
