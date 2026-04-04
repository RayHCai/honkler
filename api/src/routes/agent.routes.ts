import { Router } from 'express';
import { researchComplete, callOutcome } from '../controllers/agent.controller.js';

const router = Router();
router.post('/research-complete', researchComplete);
router.post('/call-outcome', callOutcome);

export default router;
