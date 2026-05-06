import { z } from 'zod';

export const professeurSchema = z.object({
  nom_fr: z.string().min(1),
  nom_ar: z.string().default(''),
  prenom_fr: z.string().min(1),
  prenom_ar: z.string().default(''),
  identifiant: z.string().min(1),
  mot_de_passe: z.string().min(6),
  specialite_fr: z.string().optional(),
  specialite_ar: z.string().optional(),
  telephone: z.string().optional(),
  date_embauche: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type_contrat: z.enum(['permanent', 'vacataire']).optional(),
  salaire_base: z.number().positive().optional(),
});

export type ProfesseurInput = z.infer<typeof professeurSchema>;
