-- Phase 0 refonte filières : entité Filiere en parallèle, non destructif.
-- La chaîne `filiere` ('FR'/'AR') reste la source de vérité ; on ajoute une FK
-- nullable `filiere_id` sur Classe et Matiere, backfillée depuis l'existant.

-- 1. Table Filiere
CREATE TABLE "Filiere" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom_fr" TEXT NOT NULL,
    "nom_ar" TEXT,
    "langue" TEXT NOT NULL DEFAULT 'fr',
    "sens_ecriture" TEXT NOT NULL DEFAULT 'LTR',
    "note_max" DECIMAL(5,2),
    "couleur" TEXT NOT NULL DEFAULT '#DDE2F1',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Filiere_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Filiere_etablissement_id_code_key" ON "Filiere"("etablissement_id", "code");
CREATE INDEX "Filiere_etablissement_id_idx" ON "Filiere"("etablissement_id");

ALTER TABLE "Filiere" ADD CONSTRAINT "Filiere_etablissement_id_fkey"
    FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Colonnes FK nullable
ALTER TABLE "Classe"  ADD COLUMN "filiere_id" TEXT;
ALTER TABLE "Matiere" ADD COLUMN "filiere_id" TEXT;

-- 3. Backfill : une filière par (établissement, code) distinct présent sur Classe ou Matiere.
INSERT INTO "Filiere" ("id", "etablissement_id", "code", "nom_fr", "nom_ar", "langue", "sens_ecriture", "couleur", "ordre", "actif", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    x."etablissement_id",
    x."filiere",
    CASE x."filiere" WHEN 'FR' THEN 'Filière française' WHEN 'AR' THEN 'Filière arabe' WHEN 'EN' THEN 'Filière anglaise' ELSE x."filiere" END,
    CASE x."filiere" WHEN 'AR' THEN 'الشعبة العربية' ELSE NULL END,
    CASE x."filiere" WHEN 'AR' THEN 'ar' WHEN 'EN' THEN 'en' ELSE 'fr' END,
    CASE x."filiere" WHEN 'AR' THEN 'RTL' ELSE 'LTR' END,
    CASE x."filiere" WHEN 'AR' THEN '#DCEBDF' WHEN 'EN' THEN '#F1E4DD' ELSE '#DDE2F1' END,
    CASE x."filiere" WHEN 'FR' THEN 0 WHEN 'AR' THEN 1 WHEN 'EN' THEN 2 ELSE 9 END,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "etablissement_id", "filiere" FROM "Classe"
    UNION
    SELECT DISTINCT "etablissement_id", "filiere" FROM "Matiere"
) x
ON CONFLICT ("etablissement_id", "code") DO NOTHING;

-- 4. Renseigner filiere_id à partir de la chaîne filiere.
UPDATE "Classe" c SET "filiere_id" = f."id"
FROM "Filiere" f
WHERE f."etablissement_id" = c."etablissement_id" AND f."code" = c."filiere" AND c."filiere_id" IS NULL;

UPDATE "Matiere" m SET "filiere_id" = f."id"
FROM "Filiere" f
WHERE f."etablissement_id" = m."etablissement_id" AND f."code" = m."filiere" AND m."filiere_id" IS NULL;

-- 5. Index + FK (posées après backfill : les valeurs sont valides).
CREATE INDEX "Classe_filiere_id_idx"  ON "Classe"("filiere_id");
CREATE INDEX "Matiere_filiere_id_idx" ON "Matiere"("filiere_id");

ALTER TABLE "Classe"  ADD CONSTRAINT "Classe_filiere_id_fkey"
    FOREIGN KEY ("filiere_id") REFERENCES "Filiere"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Matiere" ADD CONSTRAINT "Matiere_filiere_id_fkey"
    FOREIGN KEY ("filiere_id") REFERENCES "Filiere"("id") ON DELETE SET NULL ON UPDATE CASCADE;
