import { z } from 'zod';
import { photoUrlSchema } from '../../utils/photoUrl';

export const parentSchema = z.object({
  nom_fr: z.string().min(1),
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
  lieu_naissance: z.string().optional(),
  sexe: z.enum(['M', 'F']),
  photo_url: photoUrlSchema,
  parents: z.array(parentSchema).optional(),
});

export const inscriptionSchema = z.object({
  annee_scolaire_id: z.string().uuid(),
  classe_fr_id: z.string().optional().transform(v => (v && v.length > 0) ? v : undefined),
  classe_ar_id: z.string().optional().transform(v => (v && v.length > 0) ? v : undefined),
  // Rattachements génériques par filière (dont l'anglais). Complète/remplace les
  // deux champs FR/AR ci-dessus : chaque entrée { filiere_code, classe_id } crée
  // la ligne de jointure ; FR/AR alimentent en plus la colonne dédiée (rétro-compat).
  classes: z.array(z.object({
    filiere_code: z.enum(['FR', 'AR', 'EN']),
    classe_id: z.string().uuid(),
  })).optional(),
});

// Transfert d'un élève d'une classe à l'autre EN COURS D'ANNÉE, pour une seule
// filière à la fois (l'autre filière reste inchangée). Met à jour l'inscription
// de l'année plutôt que d'en créer une nouvelle (évite les doublons).
export const transfertSchema = z.object({
  annee_scolaire_id: z.string().uuid(),
  filiere: z.enum(['FR', 'AR', 'EN']),
  nouvelle_classe_id: z.string().uuid(),
});

export type EleveInput = z.infer<typeof eleveSchema>;
export type InscriptionInput = z.infer<typeof inscriptionSchema>;
export type TransfertInput = z.infer<typeof transfertSchema>;
