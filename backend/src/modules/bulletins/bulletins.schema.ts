import { z } from 'zod';

export const genererBulletinSchema = z.object({
  classe_id: z.string().uuid(),
  annee_scolaire_id: z.string().uuid(),
  periode: z.number().int().min(1).max(3),
  filiere: z.enum(['FR', 'AR', 'COMBINE']),
  // Flags issus du pré-vol — opt-in côté front, défauts sûrs (exclusion stricte).
  inclure_non_evaluees: z.boolean().optional(),
  traiter_manquantes_comme_zero: z.boolean().optional(),
});

export const genererBulletinAnnuelSchema = z.object({
  classe_id: z.string().uuid(),
  annee_scolaire_id: z.string().uuid(),
  filiere: z.enum(['FR', 'AR', 'COMBINE']),
  inclure_non_evaluees: z.boolean().optional(),
  traiter_manquantes_comme_zero: z.boolean().optional(),
});

export const observationSchema = z.object({
  observation_fr: z.string().max(500).optional(),
  observation_prof: z.string().max(500).optional(),
});

// Pré-vol bulletins : périmètre identique au schema de génération.
// `periode: 0` = vérification sur toutes les périodes (cas annuel).
export const preflightSchema = z.object({
  classe_id: z.string().uuid(),
  annee_scolaire_id: z.string().uuid(),
  periode: z.number().int().min(0).max(6),
  filiere: z.enum(['FR', 'AR', 'COMBINE']),
});

// Déverrouillage d'une période validée — phase 2 (action critique, admin/directeur).
export const deverrouillerPeriodeSchema = z.object({
  classe_id: z.string().uuid(),
  annee_scolaire_id: z.string().uuid(),
  periode: z.number().int().min(0).max(6),
  filiere: z.enum(['FR', 'AR', 'COMBINE']),
});

// Modèle HTML du bulletin, un par type. Borné pour éviter un payload abusif.
export const BULLETIN_TYPE_VALUES = ['FR', 'AR', 'COMBINE', 'ANNUEL'] as const;
export const bulletinTemplateTypeSchema = z.enum(BULLETIN_TYPE_VALUES);
export const bulletinTemplateSchema = z.object({
  contenu_html: z.string().min(1).max(100_000),
});

export type BulletinTemplateType = z.infer<typeof bulletinTemplateTypeSchema>;
export type BulletinTemplateInput = z.infer<typeof bulletinTemplateSchema>;
export type GenererBulletinInput = z.infer<typeof genererBulletinSchema>;
export type GenererBulletinAnnuelInput = z.infer<typeof genererBulletinAnnuelSchema>;
export type ObservationInput = z.infer<typeof observationSchema>;
export type PreflightInput = z.infer<typeof preflightSchema>;
export type DeverrouillerPeriodeInput = z.infer<typeof deverrouillerPeriodeSchema>;
