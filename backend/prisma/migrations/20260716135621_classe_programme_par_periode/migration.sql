-- AlterTable
ALTER TABLE "Classe" ADD COLUMN     "programme_par_periode" BOOLEAN NOT NULL DEFAULT false;

-- Backfill : les classes ayant déjà des surcharges par période (ClasseMatierePeriode,
-- ex. import LGM avec coef/barème par trimestre) passent en mode "par période" pour
-- que l'éditeur les affiche correctement et reste cohérent avec le calcul.
UPDATE "Classe" c
SET "programme_par_periode" = true
WHERE EXISTS (
  SELECT 1 FROM "ClasseMatierePeriode" cmp WHERE cmp."classe_id" = c."id"
);
