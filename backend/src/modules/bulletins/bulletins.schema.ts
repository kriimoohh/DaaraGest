import { z } from 'zod';

export const genererBulletinSchema = z.object({
  classe_id: z.string().uuid(),
  annee_scolaire_id: z.string().uuid(),
  periode: z.number().int().min(1),
  filiere: z.enum(['FR', 'AR']),
});

export type GenererBulletinInput = z.infer<typeof genererBulletinSchema>;
