import { z } from 'zod';

export const classeSchema = z.object({
  nom_fr: z.string().min(1),
  filiere: z.enum(['FR', 'AR']),
  niveau_id: z.string().optional().nullable(),
  annee_scolaire_id: z.string().min(1),
  capacite: z.number().int().positive().optional(),
});

export type ClasseInput = z.infer<typeof classeSchema>;
