import { z } from 'zod';

export const noteItemSchema = z.object({
  eleve_id: z.string().uuid(),
  matiere_id: z.string().uuid(),
  periode: z.number().int().min(1),
  annee_scolaire_id: z.string().uuid(),
  // Validation du plafond déléguée à bulkUpsertNotes (vérifie contre le barème
  // effectif : ClasseMatierePeriode/ClasseMatiere, sinon échelle établissement).
  // Une matière peut être /20, /100, /40 — le plafond fixe ici bloquait inutilement.
  valeur: z.number().min(0),
  commentaire: z.string().optional(),
});

export const bulkNotesSchema = z.object({
  notes: z.array(noteItemSchema).min(1),
  classe_id: z.string().uuid().optional(),
});

export type NoteItem = z.infer<typeof noteItemSchema>;
export type BulkNotesInput = z.infer<typeof bulkNotesSchema>;
export type BulkNotesPayload = BulkNotesInput;
