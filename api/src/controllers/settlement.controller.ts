import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { NotFoundError, ForbiddenError, AppError } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('SettlementController');

export async function createSettlement(req: Request, res: Response) {
  const { callLogId, amount, solanaTxSignature } = req.body;
  log.info(`Creating settlement for callLog: ${callLogId}`, { amount, hasTx: !!solanaTxSignature });

  // Verify the call log exists, is completed, and belongs to the user
  const callLog = await prisma.callLog.findUnique({
    where: { id: callLogId },
    include: { chat: true, settlement: true },
  });

  if (!callLog) throw new NotFoundError('Call log');
  if (callLog.chat.userId !== req.user!.userId) throw new ForbiddenError();
  if (callLog.status !== 'COMPLETED') {
    log.warn(`Settlement rejected — call ${callLogId} not completed (status: ${callLog.status})`);
    throw new AppError(400, 'Can only create settlements for completed calls');
  }
  if (callLog.settlement) {
    log.warn(`Settlement already exists for call ${callLogId}`);
    throw new AppError(409, 'Settlement already exists for this call');
  }

  const settlement = await prisma.settlement.create({
    data: {
      callLogId,
      userId: req.user!.userId,
      amount,
      solanaTxSignature,
      status: solanaTxSignature ? 'PROCESSING' : 'PENDING',
    },
  });

  log.info(`Settlement ${settlement.id} created: $${amount} (status: ${settlement.status})`);
  res.status(201).json({ success: true, data: settlement });
}

export async function listSettlements(req: Request, res: Response) {
  const settlements = await prisma.settlement.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: 'desc' },
    include: {
      callLog: {
        select: { id: true, outcome: true, savingsAmount: true },
      },
    },
  });

  log.debug(`Listed ${settlements.length} settlements for user ${req.user!.userId}`);
  res.json({ success: true, data: settlements });
}
