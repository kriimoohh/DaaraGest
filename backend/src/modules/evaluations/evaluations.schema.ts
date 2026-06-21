import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const evaluationSchema = z.object({
  classe_id:         z.string().min(1),
  matiere_id:        z.string().min(1),
  annee_scolaire_id: z.string().uuid(),
  periode:           z.number().int().min(1),
  titre:             z.string().min(1).max(200),
  // Types prédéfinis ('DS' | 'INTERRO' | 'DM' | 'EXAMEN' | 'CONTROLE' |
  // 'TEST_ENTREE') OU saisie libre (« Autre ») : on accepte donc tout libellé
  // non vide et borné. L'affichage retombe sur le libellé brut si inconnu.
  type:              z.string().trim().min(1).max(50),
  date:              z.string().regex(dateRegex, 'Format date invalide (YYYY-MM-DD)'),
  coefficient:       z.number().min(0.5).max(10).default(1),
  note_max:          z.number().min(1).max(100).default(20),
});

export const noteEvaluationItemSchema = z.object({
  eleve_id:    z.string().min(1),
  valeur:      z.number().min(0).max(100).nullable().optional(),
  absent:      z.boolean().optional().default(false),
  commentaire: z.string().max(500).optional(),
});

export const bulkNotesEvaluationSchema = z.object({
  notes: z.array(noteEvaluationItemSchema).min(1),
});

export type EvaluationInput      = z.infer<typeof evaluationSchema>;
export type NoteEvaluationItem   = z.infer<typeof noteEvaluationItemSchema>;
export type BulkNotesEvaluation  = z.infer<typeof bulkNotesEvaluationSchema>;
