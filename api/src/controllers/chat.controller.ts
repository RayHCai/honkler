import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { callAgent } from '../lib/agentClient.js';
import { NotFoundError, ForbiddenError } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('ChatController');

export async function createChat(req: Request, res: Response) {
  const { companyName, serviceType, currentPrice, targetPrice, documentId } = req.body;
  log.info(`Creating chat for user ${req.user!.userId}`, {
    companyName, serviceType, currentPrice, targetPrice, documentId,
  });

  // Document is required — verify it exists and belongs to the user
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new NotFoundError('Document');
  if (doc.userId !== req.user!.userId) throw new ForbiddenError();

  const chat = await prisma.chat.create({
    data: {
      userId: req.user!.userId,
      companyName: companyName || 'Analyzing...',
      serviceType: serviceType || '...',
      currentPrice,
      targetPrice,
      documentId,
    },
  });

  log.info(`Chat created: ${chat.id}, triggering research with document: ${doc.filePath}`);

  // Fire-and-forget: trigger research with the bill document
  callAgent('/api/v1/research', {
    task_id: chat.id,
    bill_document_path: doc.filePath,
    ...(companyName && { company_name: companyName }),
    ...(serviceType && { service_type: serviceType }),
    ...(currentPrice != null && { current_price: currentPrice }),
  }).then(() => {
    log.info(`Research triggered successfully for chat ${chat.id}, updating status to RESEARCHING`);
    prisma.chat.update({
      where: { id: chat.id },
      data: { status: 'RESEARCHING' },
    }).catch(() => {});
  }).catch((err) => {
    log.error(`Failed to trigger research for chat ${chat.id}`, err);
    prisma.chat.update({
      where: { id: chat.id },
      data: { status: 'FAILED' },
    }).catch(() => {});
  });

  res.status(201).json({ success: true, data: chat });
}

export async function listChats(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const [chats, total] = await Promise.all([
    prisma.chat.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        _count: { select: { messages: true, callLogs: true } },
      },
    }),
    prisma.chat.count({ where: { userId: req.user!.userId } }),
  ]);

  log.debug(`Listed ${chats.length}/${total} chats for user ${req.user!.userId} (page ${page})`);
  res.json({
    success: true,
    data: chats,
    meta: { page, limit, total },
  });
}

export async function getChat(req: Request, res: Response) {
  const id = req.params.id as string;
  const chat = await prisma.chat.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: 'asc' }, take: 50 },
      callLogs: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!chat) throw new NotFoundError('Chat');
  if (chat.userId !== req.user!.userId) throw new ForbiddenError();

  log.debug(`Fetched chat ${id} (status: ${chat.status}, messages: ${chat.messages.length}, calls: ${chat.callLogs.length})`);
  res.json({ success: true, data: chat });
}

export async function updateChat(req: Request, res: Response) {
  const id = req.params.id as string;
  const existing = await prisma.chat.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Chat');
  if (existing.userId !== req.user!.userId) throw new ForbiddenError();

  const { companyName, serviceType, currentPrice, targetPrice, status } = req.body;

  log.info(`Updating chat ${id}`, { companyName, serviceType, currentPrice, targetPrice, status });

  const chat = await prisma.chat.update({
    where: { id },
    data: {
      ...(companyName !== undefined && { companyName }),
      ...(serviceType !== undefined && { serviceType }),
      ...(currentPrice !== undefined && { currentPrice }),
      ...(targetPrice !== undefined && { targetPrice }),
      ...(status !== undefined && { status }),
    },
  });

  res.json({ success: true, data: chat });
}
