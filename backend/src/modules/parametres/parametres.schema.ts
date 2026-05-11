import { z } from 'zod';

// Passe la valeur à Prisma sous forme de string pour éviter les erreurs d'arrondi
// IEEE 754 sur les champs Decimal (ex: 7500.10 → "7500.10" conserve la précision exacte).
const zodDecimalString = z
  .union([
    z.number().finite(),
    z.string().regex(/^-?\d+(\.\d+)?$/, 'Valeur décimale invalide'),
  ])
  .transform(v => String(v));

export const etablissementUpdateSchema = z.object({
  nom_fr: z.string().min(1).optional(),
  adresse: z.string().optional(),
  telephone: z.string().optional(),
  logo_url: z.string().optional().nullable(),
  devise: z.string().optional(),
});

export const configNotesSchema = z.object({
  note_max: zodDecimalString.pipe(z.string().refine(s => parseFloat(s) > 0, 'Doit être positif')).optional(),
  note_min: zodDecimalString.pipe(z.string().refine(s => parseFloat(s) >= 0, 'Doit être ≥ 0')).optional(),
  nb_periodes: z.number().int().positive().optional(),
  noms_periodes: z.any().optional(),
  arrondi: z.number().int().min(0).optional(),
  chiffres_arabes: z.boolean().optional(),
  montant_mensualite: zodDecimalString.pipe(z.string().refine(s => parseFloat(s) > 0, 'Doit être positif')).optional(),
});

export type EtablissementUpdateInput = z.infer<typeof etablissementUpdateSchema>;
export type ConfigNotesInput = z.infer<typeof configNotesSchema>;
