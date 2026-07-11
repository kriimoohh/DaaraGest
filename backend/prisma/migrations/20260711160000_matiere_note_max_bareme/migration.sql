-- Barème de saisie par défaut de la matière (nullable → repli sur l'échelle
-- établissement quand null = comportement historique). Distinct de l'échelle
-- d'affichage de la moyenne (Filiere.note_max).
ALTER TABLE "Matiere" ADD COLUMN "note_max" DECIMAL(5,2);
