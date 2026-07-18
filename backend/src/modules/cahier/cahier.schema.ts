import { z } from 'zod';

// Dates métier au format YYYY-MM-DD (colonnes @db.Date, minuit UTC).
const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format YYYY-MM-DD');

export const journeeQuerySchema = z.object({
  date: dateISO,
  annee_scolaire_id: z.string().uuid(),
});

// Upsert d'une séance : depuis un créneau de l'emploi du temps (creneau_id →
// classe/matière/enseignant repris du créneau), ou libre (hors EDT).
export const seanceUpsertSchema = z.object({
  annee_scolaire_id: z.string().uuid(),
  classe_id: z.string().uuid(),
  matiere_id: z.string().uuid(),
  date: dateISO,
  creneau_id: z.string().uuid().nullish(),
  contenu: z.string().min(1).max(4000),
  objectif: z.string().max(1000).nullish(),
});

export const seanceUpdateSchema = z.object({
  contenu: z.string().min(1).max(4000).optional(),
  objectif: z.string().max(1000).nullish(),
});

export const seancesQuerySchema = z.object({
  classe_id: z.string().uuid(),
  annee_scolaire_id: z.string().uuid(),
  du: dateISO,
  au: dateISO,
  matiere_id: z.string().uuid().optional(),
});

export const DEVOIR_TYPES = ['LECON', 'EXERCICE', 'RECITATION', 'AUTRE'] as const;

export const devoirCreateSchema = z.object({
  annee_scolaire_id: z.string().uuid(),
  classe_id: z.string().uuid(),
  matiere_id: z.string().uuid(),
  donne_le: dateISO,
  pour_le: dateISO,
  consigne: z.string().min(1).max(2000),
  type: z.enum(DEVOIR_TYPES).default('EXERCICE'),
});

export const devoirUpdateSchema = z.object({
  consigne: z.string().min(1).max(2000).optional(),
  pour_le: dateISO.optional(),
  type: z.enum(DEVOIR_TYPES).optional(),
});

// Fenêtre sur `pour_le` : « qu'est-ce qui est à faire entre du et au ».
export const devoirsQuerySchema = z.object({
  classe_id: z.string().uuid(),
  annee_scolaire_id: z.string().uuid(),
  du: dateISO,
  au: dateISO,
  matiere_id: z.string().uuid().optional(),
});

// Visa direction : verrouille le cahier d'une classe sur [du, au].
export const visaCreateSchema = z.object({
  annee_scolaire_id: z.string().uuid(),
  classe_id: z.string().uuid(),
  du: dateISO,
  au: dateISO,
  commentaire: z.string().max(500).nullish(),
});

export const visasQuerySchema = z.object({
  classe_id: z.string().uuid(),
  annee_scolaire_id: z.string().uuid(),
});

// Complétude : séances prévues à l'emploi du temps vs renseignées sur [du, au].
export const completudeQuerySchema = z.object({
  classe_id: z.string().uuid(),
  annee_scolaire_id: z.string().uuid(),
  du: dateISO,
  au: dateISO,
});

export type JourneeQuery = z.infer<typeof journeeQuerySchema>;
export type VisaCreateInput = z.infer<typeof visaCreateSchema>;
export type VisasQuery = z.infer<typeof visasQuerySchema>;
export type CompletudeQuery = z.infer<typeof completudeQuerySchema>;
export type SeanceUpsertInput = z.infer<typeof seanceUpsertSchema>;
export type SeanceUpdateInput = z.infer<typeof seanceUpdateSchema>;
export type SeancesQuery = z.infer<typeof seancesQuerySchema>;
export type DevoirCreateInput = z.infer<typeof devoirCreateSchema>;
export type DevoirUpdateInput = z.infer<typeof devoirUpdateSchema>;
export type DevoirsQuery = z.infer<typeof devoirsQuerySchema>;
