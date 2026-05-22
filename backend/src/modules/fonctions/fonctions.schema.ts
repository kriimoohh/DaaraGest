import { z } from 'zod';

export const creerFonctionSchema = z.object({
  code:       z.string().min(1).max(50).regex(/^[A-Z_]+$/, 'Code en MAJUSCULES_AVEC_UNDERSCORES'),
  libelle_fr: z.string().min(1).max(100),
  libelle_ar: z.string().max(100).optional().nullable(),
  ordre:      z.number().int().min(0).optional(),
});

export const modifierFonctionSchema = z.object({
  libelle_fr: z.string().min(1).max(100).optional(),
  libelle_ar: z.string().max(100).optional().nullable(),
  ordre:      z.number().int().min(0).optional(),
});

export type CreerFonctionInput   = z.infer<typeof creerFonctionSchema>;
export type ModifierFonctionInput = z.infer<typeof modifierFonctionSchema>;
