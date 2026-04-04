import { Router } from 'express';
import { createChat, listChats, getChat, updateChat } from '../controllers/chat.controller.js';
import { validate } from '../middleware/validate.js';
import { createChatSchema, updateChatSchema, chatIdParam } from '../schemas/chat.schema.js';

const router = Router();
router.post('/', validate({ body: createChatSchema }), createChat);
router.get('/', listChats);
router.get('/:id', validate({ params: chatIdParam }), getChat);
router.patch('/:id', validate({ params: chatIdParam, body: updateChatSchema }), updateChat);

export default router;
