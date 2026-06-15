import { z } from 'zod';
import { photoUrlSchema } from '../../utils/photoUrl';
import { validerForceMotDePasse } from '../../utils/passwordPolicy';

// Aligné sur le catalogue Fonction par défaut (cf. table Fonction, supprimable=false).
export const FONCTION_VALUES = ['ENSEIGNANT', 'DIRECTEUR', 'SURVEILLANT', 'AGENT_SCOLARITE', 'COMPTABLE', 'AGENT_ENTRETIEN'] as const;
export type Fonction = typeof FONCTION_VALUES[number];

export const personnelSchema = z.object({
  matricule: z.string().optional(),
  nom_fr: z.string().min(1),
  prenom_fr: z.string().optional(),
  identifiant: z.string().min(1),
  mot_de_passe: z.string().refine(
    (val) => validerForceMotDePasse(val).valide,
    (val) => ({ message: `Mot de passe insuffisant : ${validerForceMotDePasse(val).raisons.join(', ')}` }),
  ),
  email: z.string().email().optional(),
  fonction:      z.enum(FONCTION_VALUES).default('ENSEIGNANT'),
  sexe:          z.enum(['M', 'F']).optional().nullable(),
  specialite_fr: z.string().optional(),
  telephone: z.string().optional(),
  date_embauche: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type_contrat: z.enum(['permanent', 'vacataire', 'stagiaire', 'CDD', 'CDI']).optional(),
  salaire_base: z.number().positive().optional(),
  photo_url: photoUrlSchema,
  poste_fr: z.string().optional(),
  date_fin_contrat: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  date_debut_stage: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  date_fin_stage:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  // État civil + qualifications
  date_naissance:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  lieu_naissance:        z.string().optional().nullable(),
  cni:                   z.string().optional().nullable(),
  numero_autorisation:   z.string().optional().nullable(),
  diplome_academique:    z.string().optional().nullable(),
  diplome_professionnel: z.string().optional().nullable(),
});

export type PersonnelInput = z.infer<typeof personnelSchema>;

export const affectationSchema = z.object({
  classe_id: z.string().uuid(),
  matiere_id: z.string().uuid(),
});

export type AffectationInput = z.infer<typeof affectationSchema>;
