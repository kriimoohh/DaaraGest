import { z } from 'zod';

export const etablissementUpdateSchema = z.object({
  nom_fr: z.string().min(1).optional(),
  nom_ar: z.string().min(1).optional(),
  adresse: z.string().optional(),
  telephone: z.string().optional(),
  logo_url: z.string().url().optional(),
  devise: z.string().optional(),
});

export const configNotesSchema = z.object({
  note_max: z.coerce.number().positive().optional(),
  note_min: z.coerce.number().min(0).optional(),
  nb_periodes: z.coerce.number().int().positive().optional(),
  noms_periodes: z.any().optional(),
  arrondi: z.coerce.number().int().min(0).optional(),
  chiffres_arabes: z.boolean().optional(),
  montant_mensualite: z.coerce.number().positive().optional(),
});

export type EtablissementUpdateInput = z.infer<typeof etablissementUpdateSchema>;
export type ConfigNotesInput = z.infer<typeof configNotesSchema>;
