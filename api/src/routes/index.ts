import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import documentRoutes from './document.routes.js';
import chatRoutes from './chat.routes.js';
import callRoutes from './call.routes.js';
import settlementRoutes from './settlement.routes.js';
import webhookRoutes from './webhook.routes.js';
import agentRoutes from './agent.routes.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', requireAuth, userRoutes);
router.use('/documents', requireAuth, documentRoutes);
router.use('/chats', requireAuth, chatRoutes);
router.use('/chats', requireAuth, callRoutes);
router.use('/settlements', requireAuth, settlementRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/agent', agentRoutes);

export default router;
