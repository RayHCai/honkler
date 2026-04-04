import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { saveFile, deleteFile, getFileUrl } from '../lib/storage.js';
import { callAgent } from '../lib/agentClient.js';
import { AppError, NotFoundError, ForbiddenError } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('DocumentController');

export async function uploadDocument(req: Request, res: Response) {
  if (!req.file) {
    throw new AppError(400, 'No file provided');
  }

  log.info(`Document upload: "${req.file.originalname}" (${req.file.mimetype}, ${req.file.size} bytes) by user ${req.user!.userId}`);

  const { key, url } = await saveFile(req.file.buffer, req.file.originalname, req.file.mimetype);
  log.info(`File saved to: ${key}`);

  const document = await prisma.document.create({
    data: {
      userId: req.user!.userId,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      filePath: key,
      fileUrl: url,
    },
  });

  // Create a chat linked to this document
  const chat = await prisma.chat.create({
    data: {
      userId: req.user!.userId,
      companyName: 'Analyzing...',
      serviceType: '...',
      documentId: document.id,
    },
  });

  log.info(`Document ${document.id} created with chat ${chat.id}, triggering research`);

  // Fire-and-forget: trigger research with the bill document
  callAgent('/api/v1/research', {
    task_id: chat.id,
    bill_document_path: document.filePath,
  }).then(() => {
    log.info(`Research triggered for document ${document.id} / chat ${chat.id}`);
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

  res.status(201).json({ success: true, data: { ...document, chat: { id: chat.id } } });
}

export async function listDocuments(req: Request, res: Response) {
  const documents = await prisma.document.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: 'desc' },
  });

  log.debug(`Listed ${documents.length} documents for user ${req.user!.userId}`);
  res.json({ success: true, data: documents });
}

export async function getDocument(req: Request, res: Response) {
  const id = req.params.id as string;
  const document = await prisma.document.findUnique({
    where: { id },
  });

  if (!document) throw new NotFoundError('Document');
  if (document.userId !== req.user!.userId) throw new ForbiddenError();

  const fileUrl = getFileUrl(document.filePath);

  res.json({ success: true, data: { ...document, fileUrl } });
}

export async function deleteDocument(req: Request, res: Response) {
  const id = req.params.id as string;
  log.info(`Deleting document: ${id} by user ${req.user!.userId}`);

  const document = await prisma.document.findUnique({
    where: { id },
  });

  if (!document) throw new NotFoundError('Document');
  if (document.userId !== req.user!.userId) throw new ForbiddenError();

  await deleteFile(document.filePath);
  await prisma.document.delete({ where: { id: document.id } });

  log.info(`Document ${id} deleted (file: ${document.filePath})`);
  res.json({ success: true, data: { id: document.id } });
}
