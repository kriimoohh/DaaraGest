import { z } from 'zod';

const COULEURS = ['success', 'info', 'warning', 'error'] as const;

export const creerMentionSchema = z.object({
  libelle_fr: z.string().min(1).max(80),
  seuil_min:  z.number().finite().min(0),
  couleur:    z.enum(COULEURS).default('info'),
  ordre:      z.number().int().min(0).optional(),
});

export const modifierMentionSchema = z.object({
  libelle_fr: z.string().min(1).max(80).optional(),
  seuil_min:  z.number().finite().min(0).optional(),
  couleur:    z.enum(COULEURS).optional(),
  ordre:      z.number().int().min(0).optional(),
});

export type CreerMentionInput    = z.infer<typeof creerMentionSchema>;
export type ModifierMentionInput = z.infer<typeof modifierMentionSchema>;
