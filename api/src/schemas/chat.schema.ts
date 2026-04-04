import { z } from 'zod';

export const createChatSchema = z.object({
  companyName: z.string().min(1).max(200).optional(),
  serviceType: z.string().min(1).max(100).optional(),
  currentPrice: z.number().positive().optional(),
  targetPrice: z.number().positive().optional(),
  documentId: z.string().uuid(),
});

export const updateChatSchema = z.object({
  companyName: z.string().min(1).max(200).optional(),
  serviceType: z.string().min(1).max(100).optional(),
  currentPrice: z.number().positive().optional(),
  targetPrice: z.number().positive().optional(),
  status: z.enum(['DRAFT', 'RESEARCHING', 'READY', 'CALLING', 'COMPLETED', 'FAILED']).optional(),
});

export const chatIdParam = z.object({
  id: z.string().uuid(),
});
