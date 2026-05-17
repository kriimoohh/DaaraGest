import { z } from 'zod';

const heureRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'] as const;

export const creneauSchema = z.object({
  annee_scolaire_id: z.string().min(1),
  classe_id: z.string().min(1),
  matiere_id: z.string().min(1),
  professeur_id: z.string().min(1),
  jour: z.enum(JOURS),
  heure_debut: z.string().regex(heureRegex, 'Format HH:MM attendu'),
  heure_fin: z.string().regex(heureRegex, 'Format HH:MM attendu'),
  salle: z.string().max(100).optional(),
});

export type CreneauInput = z.infer<typeof creneauSchema>;
