import { Router } from 'express'
import { AdminPromptController } from '@/controllers/admin/adminPrompt.controller'

const router = Router()

router.get('/', AdminPromptController.list)
router.post('/', AdminPromptController.create)
router.get('/:id', AdminPromptController.getById)
router.patch('/:id', AdminPromptController.update)
router.delete('/:id', AdminPromptController.deactivate)

export default router
