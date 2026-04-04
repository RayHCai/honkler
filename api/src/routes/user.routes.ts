import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/user.controller.js';
import { validate } from '../middleware/validate.js';
import { updateUserSchema } from '../schemas/user.schema.js';

const router = Router();
router.get('/me', getProfile);
router.patch('/me', validate({ body: updateUserSchema }), updateProfile);

export default router;
