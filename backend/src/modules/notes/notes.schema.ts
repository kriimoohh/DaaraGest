import { z } from 'zod';

export const noteItemSchema = z.object({
  eleve_id: z.string().min(1),
  matiere_id: z.string().min(1),
  periode: z.number().int().min(1),
  annee_scolaire_id: z.string().min(1),
  // Validation du plafond déléguée à bulkUpsertNotes (vérifie contre
  // matiere.note_max). Une matière peut être /20, /100, /40 selon les
  // établissements — le plafond fixe ici bloquait inutilement.
  valeur: z.number().min(0),
  commentaire: z.string().optional(),
});

export const bulkNotesSchema = z.object({
  notes: z.array(noteItemSchema).min(1),
  classe_id: z.string().min(1).optional(),
});

export type NoteItem = z.infer<typeof noteItemSchema>;
export type BulkNotesInput = z.infer<typeof bulkNotesSchema>;
export type BulkNotesPayload = BulkNotesInput;
