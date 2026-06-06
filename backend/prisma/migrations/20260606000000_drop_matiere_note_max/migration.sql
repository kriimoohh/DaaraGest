-- Suppression de Matiere.note_max : le barème de saisie d'une note est désormais
-- porté par ClasseMatierePeriode.note_max / ClasseMatiere.note_max_override, et
-- l'échelle de l'établissement par ConfigNotes.note_max. La colonne n'était plus
-- qu'un repli résiduel (toutes les notes en base ont déjà un barème de classe).
ALTER TABLE "Matiere" DROP COLUMN "note_max";
