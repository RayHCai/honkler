import { Router } from 'express';
import { twilioStatusCallback } from '../controllers/webhook.controller.js';

const router = Router();

router.post('/twilio', twilioStatusCallback);

export default router;
