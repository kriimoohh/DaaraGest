import { z } from 'zod';

const heureRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const TOUS_LES_JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] as const;

export const creneauSchema = z.object({
  annee_scolaire_id: z.string().min(1),
  classe_id: z.string().min(1),
  matiere_id: z.string().min(1),
  professeur_id: z.string().min(1),
  // Validation contre les jours actifs de l'établissement se fait dans le service
  jour: z.enum(TOUS_LES_JOURS),
  heure_debut: z.string().regex(heureRegex, 'Format HH:MM attendu'),
  heure_fin: z.string().regex(heureRegex, 'Format HH:MM attendu'),
  salle: z.string().max(100).optional(),
});

export type CreneauInput = z.infer<typeof creneauSchema>;
