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
  nom_directeur:      z.string().optional().nullable(),
  civilite_directeur: z.enum(['M', 'Mme']).optional().nullable(),
  logo_url: z.string().optional().nullable(),
  signature_url: z.string().url().optional().nullable(),
  cachet_url: z.string().url().optional().nullable(),
  devise: z.string().optional(),
});

const zodSeuil = zodDecimalString.pipe(z.string().refine(s => parseFloat(s) >= 0, 'Doit être ≥ 0'));

export const configNotesSchema = z.object({
  note_max: zodDecimalString.pipe(z.string().refine(s => parseFloat(s) > 0, 'Doit être positif')).optional(),
  note_min: zodDecimalString.pipe(z.string().refine(s => parseFloat(s) >= 0, 'Doit être ≥ 0')).optional(),
  nb_periodes: z.number().int().positive().optional(),
  noms_periodes: z.any().optional(),
  arrondi: z.number().int().min(0).optional(),
  chiffres_arabes: z.boolean().optional(),
  montant_mensualite: zodDecimalString.pipe(z.string().refine(s => parseFloat(s) > 0, 'Doit être positif')).optional(),
  jours_cours: z.array(z.enum(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'])).min(1, 'Au moins un jour de cours requis').optional(),
  seuil_tres_bien:  zodSeuil.optional(),
  seuil_bien:       zodSeuil.optional(),
  seuil_assez_bien: zodSeuil.optional(),
  seuil_passable:   zodSeuil.optional(),
  autoriser_toutes_matieres: z.boolean().optional(),
  autoriser_toutes_classes:  z.boolean().optional(),
  // Rendu des bulletins PDF. Échelles bornées pour éviter un rendu cassé.
  bulletin_afficher_rang:     z.boolean().optional(),
  bulletin_afficher_absences: z.boolean().optional(),
  bulletin_logo_echelle:      z.number().int().min(50).max(200).optional(),
  bulletin_police_echelle:    z.number().int().min(70).max(150).optional(),
}).refine(
  (d) => {
    // Si on touche aux seuils, ils doivent être dans l'ordre décroissant strict
    const tb = d.seuil_tres_bien  !== undefined ? parseFloat(d.seuil_tres_bien)  : null;
    const b  = d.seuil_bien       !== undefined ? parseFloat(d.seuil_bien)       : null;
    const ab = d.seuil_assez_bien !== undefined ? parseFloat(d.seuil_assez_bien) : null;
    const p  = d.seuil_passable   !== undefined ? parseFloat(d.seuil_passable)   : null;
    if (tb !== null && b  !== null && tb <= b)  return false;
    if (b  !== null && ab !== null && b  <= ab) return false;
    if (ab !== null && p  !== null && ab <= p)  return false;
    return true;
  },
  { message: 'Les seuils doivent être strictement décroissants (Très bien > Bien > Assez bien > Passable)' },
);

export const configNotificationsSchema = z.object({
  notif_paiement_retard: z.boolean().optional(),
  notif_absences_eleves: z.boolean().optional(),
  notif_messages: z.boolean().optional(),
  notif_inscriptions: z.boolean().optional(),
});

export type EtablissementUpdateInput = z.infer<typeof etablissementUpdateSchema>;
export type ConfigNotesInput = z.infer<typeof configNotesSchema>;
export type ConfigNotificationsInput = z.infer<typeof configNotificationsSchema>;
