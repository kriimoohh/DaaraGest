import { z } from 'zod';

export const decisionEnum = z.enum(['admis', 'redoublant', 'transfere', 'exclu']);

export const validerProgressionSchema = z.object({
  decision:       decisionEnum,
  note_directeur: z.string().max(500).optional(),
});

export const genererProgressionsSchema = z.object({
  annee_scolaire_id: z.string().uuid(),
});

export type ValiderProgressionInput  = z.infer<typeof validerProgressionSchema>;
export type GenererProgressionsInput = z.infer<typeof genererProgressionsSchema>;
