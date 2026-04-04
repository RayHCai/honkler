import { z } from 'zod';

export const updateUserSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  solanaAddress: z.string().min(32).max(44).optional(),
});
