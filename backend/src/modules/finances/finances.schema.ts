import { z } from 'zod';

export const paiementEleveSchema = z.object({
  eleve_id: z.string().min(1),
  inscription_id: z.string().min(1).optional(),
  type: z.string().min(1),
  montant: z.number().positive(),
  mois: z.number().int().min(1).max(12).optional(),
  annee: z.number().int().optional(),
  recu_numero: z.string().optional(),
});

export const bulkPaiementEleveSchema = z.object({
  eleve_ids: z.array(z.string().min(1)).min(1),
  inscription_id: z.string().min(1).optional(),
  type: z.string().min(1),
  montant: z.number().positive(),
  mois: z.number().int().min(1).max(12).optional(),
  annee: z.number().int().optional(),
});

export const updatePaiementEleveSchema = z.object({
  type: z.string().min(1).optional(),
  montant: z.number().positive().optional(),
  mois: z.number().int().min(1).max(12).optional(),
  annee: z.number().int().optional(),
  statut: z.enum(['paye', 'impaye']).optional(),
});

export const paiementProfesseurSchema = z.object({
  personnel_id: z.string().min(1),
  mois: z.number().int().min(1).max(12),
  annee: z.number().int(),
  montant_brut: z.number().positive(),
  retenues: z.number().min(0).optional(),
  net_a_payer: z.number().positive(),
  heures_theoriques: z.number().positive().optional(),
  heures_reelles: z.number().positive().optional(),
});

export type PaiementEleveInput = z.infer<typeof paiementEleveSchema>;
export type BulkPaiementEleveInput = z.infer<typeof bulkPaiementEleveSchema>;
export type UpdatePaiementEleveInput = z.infer<typeof updatePaiementEleveSchema>;
export type PaiementProfesseurInput = z.infer<typeof paiementProfesseurSchema>;
