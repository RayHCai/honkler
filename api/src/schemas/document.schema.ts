import { z } from 'zod';

export const documentIdParam = z.object({
  id: z.string().uuid(),
});
