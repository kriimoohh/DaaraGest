-- Marqueur "matière évaluée" pour bulletins.
-- Permet de signaler qu'une matière est enseignée mais ne compte pas dans la moyenne
-- (et figure sur le bulletin avec la mention "Non évaluée").
-- Résolution effective : période > classe (cf. coeff/note_max).
ALTER TABLE "ClasseMatiere"        ADD COLUMN IF NOT EXISTS "evaluee" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ClasseMatierePeriode" ADD COLUMN IF NOT EXISTS "evaluee" BOOLEAN;
