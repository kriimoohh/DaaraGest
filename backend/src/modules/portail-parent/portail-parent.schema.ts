import { z } from 'zod';

export const genererTokenSchema = z.object({
  eleve_id: z.string().uuid(),
});

export type GenererTokenInput = z.infer<typeof genererTokenSchema>;
