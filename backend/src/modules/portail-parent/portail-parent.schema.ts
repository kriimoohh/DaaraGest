import { z } from 'zod';

export const genererTokenSchema = z.object({
  eleve_id: z.string().min(1),
});

export type GenererTokenInput = z.infer<typeof genererTokenSchema>;
