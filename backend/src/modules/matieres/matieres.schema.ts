import { z } from 'zod';

export const matiereSchema = z.object({
  nom_fr: z.string().min(1),
  nom_ar: z.string().min(1),
  filiere: z.enum(['FR', 'AR']),
  coeff_defaut: z.number().positive().optional(),
  note_max: z.number().positive().max(100).optional(),
  note_min: z.number().min(0).optional(),
  ordre_bulletin: z.number().int().optional(),
});

export type MatiereInput = z.infer<typeof matiereSchema>;
