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

// Suppression multiple (réservée à la direction/gestion). Deux modes :
//  - par identifiants explicites (sélection à la case) ;
//  - par critères = « vider une colonne » (classe × matière × période × année).
export const bulkDeleteNotesSchema = z.object({
  note_ids: z.array(z.string().uuid()).min(1).optional(),
  criteres: z.object({
    classe_id: z.string().uuid(),
    matiere_id: z.string().uuid(),
    periode: z.number().int().min(1),
    annee_scolaire_id: z.string().uuid(),
  }).optional(),
}).refine(
  (d) => (d.note_ids && d.note_ids.length > 0) || d.criteres,
  { message: 'Fournir note_ids ou criteres' },
);

export type BulkDeleteNotesInput = z.infer<typeof bulkDeleteNotesSchema>;
