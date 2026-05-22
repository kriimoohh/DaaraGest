import { z } from 'zod';
import { photoUrlSchema } from '../../utils/photoUrl';
import { validerForceMotDePasse } from '../../utils/passwordPolicy';

export const FONCTION_VALUES = ['ENSEIGNANT', 'DIRECTEUR', 'SURVEILLANT', 'AGENT_SCOLARITE', 'COMPTABLE', 'INTENDANT', 'AUTRE'] as const;
export type Fonction = typeof FONCTION_VALUES[number];

export const personnelSchema = z.object({
  nom_fr: z.string().min(1),
  nom_ar: z.string().default(''),
  identifiant: z.string().min(1),
  mot_de_passe: z.string().refine(
    (val) => validerForceMotDePasse(val).valide,
    (val) => ({ message: `Mot de passe insuffisant : ${validerForceMotDePasse(val).raisons.join(', ')}` }),
  ),
  fonction:      z.enum(FONCTION_VALUES).default('ENSEIGNANT'),
  specialite_fr: z.string().optional(),
  specialite_ar: z.string().optional(),
  telephone: z.string().optional(),
  date_embauche: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type_contrat: z.enum(['permanent', 'vacataire', 'stagiaire']).optional(),
  salaire_base: z.number().positive().optional(),
  photo_url: photoUrlSchema,
  poste_fr: z.string().optional(),
  date_fin_contrat: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  date_debut_stage: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  date_fin_stage:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export type PersonnelInput = z.infer<typeof personnelSchema>;
