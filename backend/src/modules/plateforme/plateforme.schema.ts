import { z } from 'zod';

const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format YYYY-MM-DD');

export const FILIERES_DISPONIBLES = ['FR', 'AR', 'EN'] as const;

// Création d'un établissement par le super-admin plateforme.
export const creerEtablissementSchema = z.object({
  nom_fr: z.string().trim().min(2, 'Nom requis').max(200),
  // Code de l'école : saisi à la connexion et préfixe des matricules (ex. « FIC »).
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,8}$/, 'Code : 2 à 8 lettres ou chiffres'),
  adresse: z.string().trim().max(300).nullish(),
  telephone: z.string().trim().max(50).nullish(),
  email: z.string().trim().email().max(200).nullish().or(z.literal('')),
  filieres: z.array(z.enum(FILIERES_DISPONIBLES)).min(1).default(['FR', 'AR']),
  // Référentiel de 76 matières (franco-arabe) classées par domaine ; sinon l'école crée les siennes.
  referentiel_matieres: z.boolean().default(false),
  annee: z.object({ libelle: z.string().trim().min(4).max(20), date_debut: dateISO, date_fin: dateISO }).nullish(),
  admin: z.object({
    identifiant: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/, 'Identifiant : lettres, chiffres, . _ -').default('admin'),
    nom_fr: z.string().trim().min(1).max(100),
    prenom_fr: z.string().trim().max(100).nullish(),
  }),
});

export const modifierEtablissementSchema = z.object({
  actif: z.boolean().optional(),
  nom_fr: z.string().trim().min(2).max(200).optional(),
  // Changer le code change le code à saisir à la connexion (les matricules existants gardent l'ancien préfixe).
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,8}$/, 'Code : 2 à 8 lettres ou chiffres').optional(),
  adresse: z.string().trim().max(300).nullish(),
  telephone: z.string().trim().max(50).nullish(),
  email: z.string().trim().email().max(200).nullish().or(z.literal('')),
});

export type CreerEtablissementInput = z.infer<typeof creerEtablissementSchema>;
export type ModifierEtablissementInput = z.infer<typeof modifierEtablissementSchema>;
