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
  code: z
    .string()
    .min(2, 'Minimum 2 caractères')
    .max(4, 'Maximum 4 caractères')
    .regex(/^[A-Z0-9]+$/, 'Lettres majuscules et chiffres uniquement')
    .optional(),
  adresse: z.string().optional(),
  telephone: z.string().optional(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  numero_autorisation: z.string().optional().nullable(),
  entete_bulletin_fr: z.string().optional().nullable(),
  entete_bulletin_ar: z.string().optional().nullable(),
  // FK vers Personnel : source du nom/genre du directeur pour les documents.
  directeur_id:       z.string().min(1).optional().nullable(),
  logo_url: z.string().optional().nullable(),
  signature_url: z.string().url().optional().nullable(),
  cachet_url: z.string().url().optional().nullable(),
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
  jours_cours: z.array(z.enum(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'])).min(1, 'Au moins un jour de cours requis').optional(),
  autoriser_toutes_matieres: z.boolean().optional(),
  autoriser_toutes_classes:  z.boolean().optional(),
  // Rendu des bulletins PDF. Échelles bornées pour éviter un rendu cassé.
  bulletin_afficher_rang:     z.boolean().optional(),
  bulletin_afficher_absences: z.boolean().optional(),
  bulletin_logo_echelle:      z.number().int().min(50).max(200).optional(),
  bulletin_police_echelle:    z.number().int().min(70).max(150).optional(),
  // Filière décisionnaire du passage : 'COMBINE' ou un code de filière (FR, AR…).
  // Valeur libre bornée : les codes de filière sont propres à l'établissement.
  filiere_decision:           z.string().min(1).max(20).optional(),
});

export const configNotificationsSchema = z.object({
  notif_paiement_retard: z.boolean().optional(),
  notif_absences_eleves: z.boolean().optional(),
  notif_messages: z.boolean().optional(),
  notif_inscriptions: z.boolean().optional(),
});

export type EtablissementUpdateInput = z.infer<typeof etablissementUpdateSchema>;
export type ConfigNotesInput = z.infer<typeof configNotesSchema>;
export type ConfigNotificationsInput = z.infer<typeof configNotificationsSchema>;
