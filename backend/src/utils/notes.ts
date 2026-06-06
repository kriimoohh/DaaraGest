// Échelle de notation de repli ULTIME, utilisée uniquement si un établissement
// n'a aucune ConfigNotes (cas anormal). L'échelle réelle d'un établissement est
// toujours ConfigNotes.note_max ; le barème brut de saisie d'une note est porté
// par ClasseMatierePeriode.note_max / ClasseMatiere.note_max_override. Cette
// constante évite de coder « 20 » en dur un peu partout.
export const DEFAULT_NOTE_MAX = 20;
