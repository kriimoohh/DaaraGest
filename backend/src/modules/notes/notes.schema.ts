import { z } from 'zod';

export const noteItemSchema = z.object({
  eleve_id: z.string().min(1),
  matiere_id: z.string().min(1),
  periode: z.number().int().min(1),
  annee_scolaire_id: z.string().min(1),
  valeur: z.number().min(0).max(20),
  commentaire: z.string().optional(),
});

export const bulkNotesSchema = z.object({
  notes: z.array(noteItemSchema).min(1),
});

export type NoteItem = z.infer<typeof noteItemSchema>;
export type BulkNotesInput = z.infer<typeof bulkNotesSchema>;
