import { z } from 'zod';

export const parentSchema = z.object({
  nom_fr: z.string().min(1),
  nom_ar: z.string().optional(),
  lien: z.enum(['pere', 'mere', 'tuteur']),
  telephone: z.string().min(1),
  email: z.string().email().optional(),
  adresse: z.string().optional(),
});

export const eleveSchema = z.object({
  matricule: z.string().optional(),
  nom_fr: z.string().min(1),
  prenom_fr: z.string().min(1),
  date_naissance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sexe: z.enum(['M', 'F']),
  photo_url: z.string().url().optional(),
  parents: z.array(parentSchema).optional(),
});

export const inscriptionSchema = z.object({
  annee_scolaire_id: z.string().min(1),
  classe_fr_id: z.string().min(1).optional(),
  classe_ar_id: z.string().min(1).optional(),
});

export type EleveInput = z.infer<typeof eleveSchema>;
export type InscriptionInput = z.infer<typeof inscriptionSchema>;
