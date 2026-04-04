import { Router } from 'express';
import { initiateCall, getCallStatus } from '../controllers/call.controller.js';
import { validate } from '../middleware/validate.js';
import { chatIdParam } from '../schemas/chat.schema.js';

const router = Router();
router.post('/:id/call', validate({ params: chatIdParam }), initiateCall);
router.get('/:id/call', validate({ params: chatIdParam }), getCallStatus);

export default router;
