import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { validateTwilioWebhook } from '../lib/twilio.js';
import { UnauthorizedError } from '../lib/errors.js';
import { CallStatus } from '@prisma/client';
import { createLogger } from '../lib/logger.js';

const log = createLogger('WebhookController');

const STATUS_MAP: Record<string, CallStatus> = {
  initiated: 'INITIATED',
  ringing: 'RINGING',
  'in-progress': 'IN_PROGRESS',
  completed: 'COMPLETED',
  failed: 'FAILED',
  'no-answer': 'NO_ANSWER',
  busy: 'FAILED',
  canceled: 'FAILED',
};

export async function twilioStatusCallback(req: Request, res: Response) {
  // Validate Twilio signature
  const signature = req.headers['x-twilio-signature'] as string;
  if (!signature) {
    log.warn('Twilio webhook received without signature');
    throw new UnauthorizedError('Missing Twilio signature');
  }

  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  if (!validateTwilioWebhook(signature, url, req.body)) {
    log.warn('Twilio webhook with invalid signature');
    throw new UnauthorizedError('Invalid Twilio signature');
  }

  const { CallSid, CallStatus: twilioStatus, CallDuration, RecordingUrl } = req.body;
  const status = STATUS_MAP[twilioStatus] || 'FAILED';

  log.info(`Twilio webhook: CallSid=${CallSid} status=${twilioStatus} → ${status}`, {
    duration: CallDuration,
    recordingUrl: RecordingUrl,
  });

  const callLog = await prisma.callLog.findUnique({
    where: { twilioCallSid: CallSid },
  });

  if (!callLog) {
    log.warn(`Unknown CallSid in Twilio webhook: ${CallSid}`);
    // Unknown call — respond 200 so Twilio doesn't retry
    res.status(200).send('<Response/>');
    return;
  }

  log.info(`Updating CallLog ${callLog.id} status: ${callLog.status} → ${status}`);
  await prisma.callLog.update({
    where: { id: callLog.id },
    data: {
      status,
      ...(CallDuration && { duration: parseInt(CallDuration, 10) }),
      ...(RecordingUrl && { recordingUrl: RecordingUrl }),
    },
  });

  // If call completed, update chat status
  if (status === 'COMPLETED' || status === 'FAILED' || status === 'NO_ANSWER') {
    const chatStatus = status === 'COMPLETED' ? 'COMPLETED' : 'FAILED';
    log.info(`Updating chat ${callLog.chatId} to ${chatStatus}`);
    await prisma.chat.update({
      where: { id: callLog.chatId },
      data: { status: chatStatus },
    });
  }

  res.status(200).send('<Response/>');
}
