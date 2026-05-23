import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = ['vacances', 'examen', 'evenement', 'fermeture', 'reunion'] as const;

export const evenementSchema = z.object({
  titre_fr: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  date_debut: z.string().regex(dateRegex, 'Format date invalide (YYYY-MM-DD)'),
  date_fin: z.string().regex(dateRegex, 'Format date invalide (YYYY-MM-DD)'),
  type: z.enum(TYPES),
  couleur: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export type EvenementInput = z.infer<typeof evenementSchema>;
