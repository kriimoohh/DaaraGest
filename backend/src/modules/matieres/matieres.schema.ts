import { z } from 'zod';

export const matiereSchema = z.object({
  nom_fr: z.string().min(1),
  nom_ar: z.string().min(1),
  filiere: z.enum(['FR', 'AR']),
  coeff_defaut: z.number().positive().optional(),
  ordre_bulletin: z.number().int().optional(),
});

export type MatiereInput = z.infer<typeof matiereSchema>;
