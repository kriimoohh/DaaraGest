-- Coefficients/barèmes par trimestre (override de ClasseMatiere) pour les matières
-- dont le coefficient change selon le trimestre (notamment arabe). Idempotent.
CREATE TABLE IF NOT EXISTS "ClasseMatierePeriode" (
    "id" TEXT NOT NULL,
    "classe_id" TEXT NOT NULL,
    "matiere_id" TEXT NOT NULL,
    "periode" INTEGER NOT NULL,
    "coeff" DECIMAL(4,2) NOT NULL,
    "note_max" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClasseMatierePeriode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClasseMatierePeriode_classe_id_matiere_id_periode_key" ON "ClasseMatierePeriode"("classe_id", "matiere_id", "periode");
CREATE INDEX IF NOT EXISTS "ClasseMatierePeriode_classe_id_periode_idx" ON "ClasseMatierePeriode"("classe_id", "periode");
