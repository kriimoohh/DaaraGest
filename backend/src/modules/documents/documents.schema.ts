import { z } from 'zod';

export const TYPE_DOCUMENT_VALUES = [
  'CERTIFICAT_SCOLARITE', 'ATTESTATION_INSCRIPTION', 'CONVOCATION_EXAMEN',
  'FICHE_TRANSFERT', 'EMPLOI_DU_TEMPS_ELEVE', 'RELEVE_NOTES',
  'CERTIFICAT_BONNE_CONDUITE', 'FICHE_RENSEIGNEMENTS', 'ATTESTATION_RESULTATS',
  'LISTE_CLASSE', 'ATTESTATION_TRAVAIL', 'ORDRE_MISSION', 'FICHE_PAIE', 'PLANNING_COURS',
  'CARTE_ELEVE', 'CARTE_PROFESSEUR',
] as const;

export const CARD_TYPES: ReadonlySet<TypeDocument> = new Set(['CARTE_ELEVE', 'CARTE_PROFESSEUR']);

export type TypeDocument = typeof TYPE_DOCUMENT_VALUES[number];

export const upsertTemplateSchema = z.object({
  nom: z.string().min(1).max(200),
  contenu_html: z.string().min(1),
});

export const genererDocumentSchema = z.object({
  type: z.enum(TYPE_DOCUMENT_VALUES),
  destinataire_type: z.enum(['eleve', 'professeur', 'classe']),
  destinataire_id: z.string().min(1),
  parametres: z.record(z.string()).optional(),
});

export const genererCartesLotSchema = z.object({
  type: z.enum(['CARTE_ELEVE', 'CARTE_PROFESSEUR']),
  ids: z.array(z.string().min(1)).min(1).max(200),
});

export type UpsertTemplateInput = z.infer<typeof upsertTemplateSchema>;
export type GenererDocumentInput = z.infer<typeof genererDocumentSchema>;
export type GenererCartesLotInput = z.infer<typeof genererCartesLotSchema>;
