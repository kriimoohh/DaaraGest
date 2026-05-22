import { z } from 'zod';

export const genererBulletinSchema = z.object({
  classe_id: z.string().uuid(),
  annee_scolaire_id: z.string().uuid(),
  periode: z.number().int().min(1).max(3),
  filiere: z.enum(['FR', 'AR', 'COMBINE']),
});

export const genererBulletinAnnuelSchema = z.object({
  classe_id: z.string().uuid(),
  annee_scolaire_id: z.string().uuid(),
  filiere: z.enum(['FR', 'AR', 'COMBINE']),
});

export const observationSchema = z.object({
  observation_fr: z.string().max(500).optional(),
  observation_ar: z.string().max(500).optional(),
  observation_prof: z.string().max(500).optional(),
});

export type GenererBulletinInput = z.infer<typeof genererBulletinSchema>;
export type GenererBulletinAnnuelInput = z.infer<typeof genererBulletinAnnuelSchema>;
export type ObservationInput = z.infer<typeof observationSchema>;
