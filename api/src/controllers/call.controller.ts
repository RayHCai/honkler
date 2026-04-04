import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { callAgent } from '../lib/agentClient.js';
import { NotFoundError, ForbiddenError, AppError } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('CallController');

export async function initiateCall(req: Request, res: Response) {
  const id = req.params.id as string;
  log.info(`Call initiation requested for chat: ${id} by user: ${req.user!.userId}`);

  const chat = await prisma.chat.findUnique({ where: { id } });

  if (!chat) throw new NotFoundError('Chat');
  if (chat.userId !== req.user!.userId) throw new ForbiddenError();
  if (chat.status === 'CALLING') {
    log.warn(`Call already in progress for chat: ${id}`);
    throw new AppError(409, 'A call is already in progress for this chat');
  }
  if (chat.status !== 'READY' || !chat.negotiationPlan) {
    log.warn(`Chat ${id} not ready for calling (status: ${chat.status})`);
    throw new AppError(400, 'Chat must have a completed research plan before calling');
  }
  if (!chat.companyPhone) {
    log.warn(`No phone number for chat: ${id}`);
    throw new AppError(400, 'No company phone number available — research may not have found one');
  }

  const phoneNumber = chat.companyPhone;
  log.info(`Calling ${phoneNumber} for ${chat.companyName} (${chat.serviceType})`, {
    currentPrice: chat.currentPrice,
    targetPrice: chat.targetPrice,
  });

  // Look up user's wallet address
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });

  // Create call log first
  const callLog = await prisma.callLog.create({
    data: { chatId: chat.id },
  });
  log.info(`CallLog created: ${callLog.id}`);

  // Delegate call to the Python agent (ElevenLabs voice)
  log.info(`Delegating call to Python agent for callLog: ${callLog.id}`);
  const agentResponse = await callAgent('/api/v1/calls', {
    call_id: callLog.id,
    task_id: chat.id,
    phone_number: phoneNumber,
    negotiation_plan: chat.negotiationPlan,
    user_id: req.user!.userId,
    wallet_address: user?.solanaAddress || '',
  }) as { twilio_call_sid?: string };

  log.info(`Agent responded with call_sid: ${agentResponse.twilio_call_sid || 'none'}`);

  // Update call log with agent response and mark chat as calling
  const [updatedCallLog] = await Promise.all([
    prisma.callLog.update({
      where: { id: callLog.id },
      data: {
        ...(agentResponse.twilio_call_sid && { twilioCallSid: agentResponse.twilio_call_sid }),
        status: 'RINGING',
      },
    }),
    prisma.chat.update({
      where: { id: chat.id },
      data: { status: 'CALLING' },
    }),
  ]);

  log.info(`Call initiated successfully — chat ${id} now CALLING`);
  res.status(201).json({ success: true, data: updatedCallLog });
}

export async function getCallStatus(req: Request, res: Response) {
  const id = req.params.id as string;
  const chat = await prisma.chat.findUnique({ where: { id } });
  if (!chat) throw new NotFoundError('Chat');
  if (chat.userId !== req.user!.userId) throw new ForbiddenError();

  const callLog = await prisma.callLog.findFirst({
    where: { chatId: chat.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!callLog) throw new NotFoundError('Call');

  log.debug(`Call status for chat ${id}: ${callLog.status}`);
  res.json({ success: true, data: callLog });
}
