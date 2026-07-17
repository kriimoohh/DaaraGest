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

// Deux moyennes arrondies au centième sont « égales » à ce delta près. Même
// tolérance que mentionDefPour : on ne veut pas qu'un artefact de virgule
// flottante départage deux élèves ex aequo.
const EPS_MOYENNE = 1e-9;

/**
 * Classe des élèves par moyenne décroissante et attribue les rangs selon la
 * convention scolaire dite « compétition » : deux moyennes égales partagent le
 * même rang, et le rang suivant saute d'autant (15, 15, 12 → 1, 1, 3).
 *
 * La fonction possède le tri ET le classement : ne pas trier soi-même avant de
 * l'appeler, sinon deux appelants peuvent produire des rangs différents pour la
 * même classe (c'est ce qui avait divergé sur 7 sites).
 *
 * Une moyenne `null` (élève sans aucune note) est placée en fin de liste et ne
 * reçoit AUCUN rang (`rang: null`) : on ne classe pas un élève non évalué.
 */
export function classer<T>(
  items: readonly T[],
  moyenneDe: (item: T) => number | null,
): Array<T & { rang: number | null }> {
  const tries = [...items].sort((a, b) => {
    const ma = moyenneDe(a), mb = moyenneDe(b);
    if (ma === null && mb === null) return 0;
    if (ma === null) return 1;  // les non-classés en dernier
    if (mb === null) return -1;
    return mb - ma;
  });

  const res: Array<T & { rang: number | null }> = [];
  let precedente: number | null = null;
  let rangPrecedent = 0;
  let classes = 0;

  for (const item of tries) {
    const m = moyenneDe(item);
    if (m === null) {
      res.push({ ...item, rang: null });
      continue;
    }
    classes++;
    const exAequo = precedente !== null && Math.abs(m - precedente) < EPS_MOYENNE;
    const rang = exAequo ? rangPrecedent : classes;
    if (!exAequo) { rangPrecedent = rang; precedente = m; }
    res.push({ ...item, rang });
  }
  return res;
}
