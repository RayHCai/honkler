import { z } from 'zod';

export const createSettlementSchema = z.object({
  callLogId: z.string().uuid(),
  amount: z.number().positive(),
  solanaTxSignature: z.string().optional(),
});
