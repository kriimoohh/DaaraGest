-- Échelle d'affichage de la moyenne portée par le NIVEAU (primaire /10, secondaire
-- /20 dans un même établissement). null = repli sur ConfigNotes.note_max.
ALTER TABLE "Niveau" ADD COLUMN "note_max" DECIMAL(5,2);

-- Retrait de l'échelle par FILIÈRE (mauvais axe : l'échelle dépend du niveau, pas
-- de la filière). La colonne était nullable et non renseignée (aucune donnée perdue).
ALTER TABLE "Filiere" DROP COLUMN "note_max";
