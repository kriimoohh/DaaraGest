// Échelle de notation de repli ULTIME, utilisée uniquement si un établissement
// n'a aucune ConfigNotes (cas anormal). L'échelle réelle d'un établissement est
// toujours ConfigNotes.note_max ; le barème brut de saisie d'une note est porté
// par ClasseMatierePeriode.note_max / ClasseMatiere.note_max_override. Cette
// constante évite de coder « 20 » en dur un peu partout.
export const DEFAULT_NOTE_MAX = 20;

// Mention d'appréciation résolue depuis la table Mention (seule source des
// seuils depuis le retrait des colonnes ConfigNotes.seuil_*).
export type MentionDef = { libelle_fr: string; libelle_ar?: string | null; seuil_min: number };

/** Mention atteinte pour une moyenne : première mention (triées par seuil
 *  décroissant) dont le seuil est atteint ; sinon la dernière (« Insuffisant »). */
export function mentionDefPour(m: number, mentions: MentionDef[]): MentionDef | null {
  for (const mention of mentions) if (m + 1e-9 >= mention.seuil_min) return mention;
  return mentions.length ? mentions[mentions.length - 1] : null;
}

/** Libellé français de la mention atteinte. */
export function mentionPour(m: number, mentions: MentionDef[]): string {
  return mentionDefPour(m, mentions)?.libelle_fr ?? '';
}

/** Libellé de mention dans la langue du bulletin : arabe (si renseigné) pour
 *  la filière AR, français sinon. */
export function mentionPourFiliere(m: number, mentions: MentionDef[], filiereCode: string): string {
  const def = mentionDefPour(m, mentions);
  if (!def) return '';
  return filiereCode === 'AR' ? (def.libelle_ar?.trim() || def.libelle_fr) : def.libelle_fr;
}
