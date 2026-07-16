import { z } from 'zod';

export const classeSchema = z.object({
  nom_fr: z.string().min(1),
  nom_ar: z.string().optional().nullable(),
  filiere: z.enum(['FR', 'AR', 'EN']),
  niveau_id: z.string().optional().nullable(),
  annee_scolaire_id: z.string().uuid(),
  capacite: z.number().int().positive().optional(),
});

export const classeMatiereSchema = z.object({
  matiere_id: z.string().uuid(),
  coeff_override: z.number().positive().optional(),
  ordre_override: z.number().int().min(0).optional(),
  // Décision pédagogique : matière enseignée mais non évaluée → hors moyenne du bulletin.
  evaluee: z.boolean().optional(),
});

export const classeMatiereUpdateSchema = z.object({
  coeff_override: z.number().positive().nullable().optional(),
  ordre_override: z.number().int().min(0).nullable().optional(),
  evaluee: z.boolean().optional(),
});

// Override "évaluée" par trimestre (ex: matière évaluée au T2 mais pas au T1/T3).
// null sur evaluee remet l'override "non défini" (= hérite de ClasseMatiere).
export const classeMatierePeriodeSchema = z.object({
  matiere_id: z.string().uuid(),
  periode: z.number().int().min(1).max(6),
  coeff: z.number().positive().optional(),
  note_max: z.number().positive().optional(),
  evaluee: z.boolean().nullable().optional(),
});

// Mode du programme de la classe : identique toute l'année (false) ou par période (true).
export const programmeModeSchema = z.object({
  programme_par_periode: z.boolean(),
});

// Duplication d'une classe vers une AUTRE filière (générique : AR, EN…). Les
// élèves de la classe source sont rattachés à la nouvelle classe pour la filière
// cible (sauf ceux qui y ont déjà une classe).
export const dupliquerClasseSchema = z.object({
  filiere_cible: z.enum(['FR', 'AR', 'EN']),
  nom_fr: z.string().min(1).optional(),
});

export type ClasseInput = z.infer<typeof classeSchema>;
export type ClasseMatiereInput = z.infer<typeof classeMatiereSchema>;
export type ClasseMatiereUpdateInput = z.infer<typeof classeMatiereUpdateSchema>;
export type ClasseMatierePeriodeInput = z.infer<typeof classeMatierePeriodeSchema>;
export type ProgrammeModeInput = z.infer<typeof programmeModeSchema>;
export type DupliquerClasseInput = z.infer<typeof dupliquerClasseSchema>;
