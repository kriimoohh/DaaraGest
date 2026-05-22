import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const activiteSchema = z.object({
  nom_fr:         z.string().min(1).max(200),
  nom_ar:         z.string().max(200).optional(),
  description:    z.string().max(1000).optional(),
  responsable_id: z.string().uuid().optional(),
  capacite_max:   z.number().int().min(1).optional(),
  actif:          z.boolean().optional().default(true),
});

export const inscriptionActiviteSchema = z.object({
  eleve_id:          z.string().min(1),
  annee_scolaire_id: z.string().uuid(),
});

export const seanceSchema = z.object({
  date:      z.string().regex(dateRegex, 'Format date invalide (YYYY-MM-DD)'),
  duree_min: z.number().int().min(1).optional(),
  notes:     z.string().max(1000).optional(),
});

export const presenceActiviteItemSchema = z.object({
  eleve_id: z.string().uuid(),
  statut:   z.enum(['present', 'absent', 'retard']),
});

export const bulkPresencesSchema = z.object({
  presences: z.array(presenceActiviteItemSchema).min(1),
});

export const evaluationActiviteSchema = z.object({
  periode:      z.number().int().min(1).optional(),
  appreciation: z.string().max(1000).optional(),
  note:         z.number().min(0).max(20).optional(),
});

export type ActiviteInput             = z.infer<typeof activiteSchema>;
export type InscriptionActiviteInput  = z.infer<typeof inscriptionActiviteSchema>;
export type SeanceInput               = z.infer<typeof seanceSchema>;
export type PresenceActiviteItem      = z.infer<typeof presenceActiviteItemSchema>;
export type BulkPresencesInput        = z.infer<typeof bulkPresencesSchema>;
export type EvaluationActiviteInput   = z.infer<typeof evaluationActiviteSchema>;
