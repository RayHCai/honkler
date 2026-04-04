import { Router } from 'express';
import { createSettlement, listSettlements } from '../controllers/settlement.controller.js';
import { validate } from '../middleware/validate.js';
import { createSettlementSchema } from '../schemas/settlement.schema.js';

const router = Router();
router.post('/', validate({ body: createSettlementSchema }), createSettlement);
router.get('/', listSettlements);

export default router;
