-- Migration: nouveau système de matricules
-- Élèves  : {CODE}-E-{AA}-{NNN}  ex: FIC-E-26-001
-- Personnel: {CODE}-P-{AA}-{NNN}  ex: FIC-P-26-001

-- ── 1. Code établissement (préfixe des matricules) ──────────────────────────
ALTER TABLE "Etablissement" ADD COLUMN IF NOT EXISTS "code" TEXT;

-- Backfill pour les établissements existants : 3-4 premières lettres du nom
UPDATE "Etablissement"
SET "code" = UPPER(LEFT(REGEXP_REPLACE(nom_fr, '[^a-zA-Z]', '', 'g'), 4))
WHERE "code" IS NULL;

-- Fallback si le résultat est trop court
UPDATE "Etablissement"
SET "code" = 'ETS'
WHERE "code" IS NULL OR LENGTH("code") < 2;

ALTER TABLE "Etablissement" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Etablissement_code_key" ON "Etablissement"("code");

-- ── 2. Matricule personnel ───────────────────────────────────────────────────
ALTER TABLE "Personnel" ADD COLUMN IF NOT EXISTS "matricule" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Personnel_matricule_key" ON "Personnel"("matricule");
