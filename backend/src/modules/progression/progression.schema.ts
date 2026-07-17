import { z } from 'zod';

// 'a_examiner' = décision auto par défaut quand aucune moyenne annuelle n'existe
// (bulletin non généré / élève sans note). Force un arbitrage humain plutôt qu'un
// « admis » silencieux. Une progression ne se valide jamais SUR 'a_examiner' :
// le directeur doit choisir un statut réel (validerProgression le refuse).
export const decisionEnum = z.enum(['admis', 'redoublant', 'transfere', 'exclu', 'a_examiner']);

export const validerProgressionSchema = z.object({
  decision:       decisionEnum,
  note_directeur: z.string().max(500).optional(),
});

export const genererProgressionsSchema = z.object({
  annee_scolaire_id: z.string().uuid(),
});

export type ValiderProgressionInput  = z.infer<typeof validerProgressionSchema>;
export type GenererProgressionsInput = z.infer<typeof genererProgressionsSchema>;
