import { z } from 'zod';

export const paiementEleveSchema = z.object({
  eleve_id: z.string().uuid(),
  inscription_id: z.string().uuid().optional(),
  type: z.string().min(1),
  montant: z.number().positive(),
  mois: z.number().int().min(1).max(12).optional(),
  annee: z.number().int().optional(),
  recu_numero: z.string().optional(),
});

export const paiementProfesseurSchema = z.object({
  professeur_id: z.string().uuid(),
  mois: z.number().int().min(1).max(12),
  annee: z.number().int(),
  montant_brut: z.number().positive(),
  retenues: z.number().min(0).optional(),
  net_a_payer: z.number().positive(),
  heures_theoriques: z.number().positive().optional(),
  heures_reelles: z.number().positive().optional(),
});

export type PaiementEleveInput = z.infer<typeof paiementEleveSchema>;
export type PaiementProfesseurInput = z.infer<typeof paiementProfesseurSchema>;
