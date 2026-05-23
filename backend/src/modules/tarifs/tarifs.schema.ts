import { z } from 'zod';

const zodMontant = z.union([z.number(), z.string()])
  .transform(v => String(v))
  .pipe(z.string().regex(/^-?\d+(\.\d+)?$/, 'Montant invalide').refine(s => parseFloat(s) >= 0, 'Montant ≥ 0'));

export const PERIODICITES = ['ponctuel', 'mensuel', 'annuel'] as const;

export const creerTarifSchema = z.object({
  code:           z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/, 'Code en MAJUSCULES_AVEC_UNDERSCORES (et chiffres)'),
  libelle_fr:     z.string().min(1).max(100),
  description:    z.string().max(500).optional().nullable(),
  montant_defaut: zodMontant,
  periodicite:    z.enum(PERIODICITES).optional(),
  obligatoire:    z.boolean().optional(),
  actif:          z.boolean().optional(),
  ordre:          z.number().int().min(0).optional(),
});

export const modifierTarifSchema = z.object({
  libelle_fr:     z.string().min(1).max(100).optional(),
  description:    z.string().max(500).optional().nullable(),
  montant_defaut: zodMontant.optional(),
  periodicite:    z.enum(PERIODICITES).optional(),
  obligatoire:    z.boolean().optional(),
  actif:          z.boolean().optional(),
  ordre:          z.number().int().min(0).optional(),
});

export type CreerTarifInput    = z.infer<typeof creerTarifSchema>;
export type ModifierTarifInput = z.infer<typeof modifierTarifSchema>;
