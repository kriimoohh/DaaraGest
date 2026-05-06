import { z } from 'zod';

export const anneeScolaireSchema = z.object({
  libelle: z.string().min(1),
  date_debut: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  date_fin: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export type AnneeScolaireInput = z.infer<typeof anneeScolaireSchema>;
