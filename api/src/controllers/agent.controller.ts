import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { NotFoundError, AppError } from '../lib/errors.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('AgentController');

export async function researchComplete(req: Request, res: Response) {
  const { task_id, plan } = req.body;

  log.info(`Research complete callback received for task: ${task_id}`);

  if (!task_id || typeof task_id !== 'string') {
    throw new AppError(400, 'task_id is required');
  }
  if (!plan || typeof plan !== 'object') {
    throw new AppError(400, 'plan is required');
  }

  log.info(`Negotiation plan received`, {
    task_id,
    company: plan.company_name,
    service: plan.service_type,
    currentPrice: plan.current_price,
    targetPrice: plan.target_price,
    phone: plan.customer_service_phone,
    talkingPoints: plan.talking_points?.length,
    competingOffers: plan.competing_offers?.length,
  });

  const chat = await prisma.chat.findUnique({ where: { id: task_id } });
  if (!chat) throw new NotFoundError('Chat');

  await prisma.chat.update({
    where: { id: task_id },
    data: {
      status: 'READY',
      negotiationPlan: plan,
      ...(plan.company_name && { companyName: plan.company_name }),
      ...(plan.service_type && { serviceType: plan.service_type }),
      ...(plan.customer_service_phone && { companyPhone: plan.customer_service_phone }),
      ...(plan.current_price != null && { currentPrice: plan.current_price }),
      ...(plan.target_price != null && { targetPrice: plan.target_price }),
    },
  });

  log.info(`Chat ${task_id} updated to READY status`);
  res.json({ success: true });
}

export async function callOutcome(req: Request, res: Response) {
  const { call_id, outcome } = req.body;

  log.info(`Call outcome callback received for call: ${call_id}`);

  if (!call_id || typeof call_id !== 'string') {
    throw new AppError(400, 'call_id is required');
  }
  if (!outcome || typeof outcome !== 'object') {
    throw new AppError(400, 'outcome is required');
  }

  log.info(`Call outcome details`, {
    call_id,
    success: outcome.success,
    agreedPrice: outcome.agreed_price,
    savings: outcome.savings_achieved,
    confidence: outcome.confidence,
    summary: outcome.agreement_summary,
  });

  const callLog = await prisma.callLog.findUnique({
    where: { id: call_id },
    include: { chat: true },
  });
  if (!callLog) throw new NotFoundError('CallLog');

  const callLogStatus = outcome.success ? 'COMPLETED' : 'FAILED';
  await prisma.callLog.update({
    where: { id: call_id },
    data: {
      status: callLogStatus,
      outcome: JSON.stringify(outcome),
      ...(outcome.transcript != null && { transcript: outcome.transcript }),
      ...(outcome.savings_achieved != null && { savingsAmount: outcome.savings_achieved }),
    },
  });

  const newStatus = outcome.success ? 'COMPLETED' : 'FAILED';
  await prisma.chat.update({
    where: { id: callLog.chatId },
    data: { status: newStatus },
  });

  log.info(`Chat ${callLog.chatId} updated to ${newStatus} (savings: $${outcome.savings_achieved || 0})`);
  res.json({ success: true });
}
