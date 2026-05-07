import { z } from 'zod';

export const presenceSchema = z.object({
  professeur_id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)'),
  statut: z.enum(['present', 'absent', 'retard', 'conge']),
  heures_prevues: z.number().positive().optional(),
  heures_reelles: z.number().min(0).optional(),
  motif: z.string().optional(),
});

export const bulkPresenceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  presences: z.array(presenceSchema.omit({ date: true })).min(1),
});

export type PresenceInput = z.infer<typeof presenceSchema>;
export type BulkPresenceInput = z.infer<typeof bulkPresenceSchema>;
