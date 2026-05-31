-- Migration: nouveau système de matricules
-- Élèves  : {CODE}-E-{AA}-{NNN}  ex: FIC-E-26-001
-- Personnel: {CODE}-P-{AA}-{NNN}  ex: FIC-P-26-001

-- ── 1. Code établissement ─────────────────────────────────────────────────
ALTER TABLE "Etablissement" ADD COLUMN IF NOT EXISTS "code" TEXT;

UPDATE "Etablissement"
SET "code" = UPPER(LEFT(REGEXP_REPLACE(nom_fr, '[^a-zA-Z]', '', 'g'), 4))
WHERE "code" IS NULL;

UPDATE "Etablissement" SET "code" = 'ETS'
WHERE "code" IS NULL OR LENGTH("code") < 2;

ALTER TABLE "Etablissement" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Etablissement_code_key" ON "Etablissement"("code");

-- ── 2. Conversion des matricules élèves existants ─────────────────────────
-- DG-2024-001 → FIC-E-24-001
-- Seuls les matricules au format DG-YYYY-NNN sont convertis.
UPDATE "Eleve" e
SET matricule =
  etab.code || '-E-' ||
  RIGHT(SUBSTRING(e.matricule, 4, 4), 2) || '-' ||
  LPAD(SUBSTRING(e.matricule, 9), 3, '0')
FROM "Etablissement" etab
WHERE etab.id = e.etablissement_id
  AND e.matricule ~ '^DG-[0-9]{4}-[0-9]+$';

-- ── 3. Matricule personnel ────────────────────────────────────────────────
ALTER TABLE "Personnel" ADD COLUMN IF NOT EXISTS "matricule" TEXT;

-- Attribue automatiquement un matricule à tout le personnel existant.
-- Année = année d'embauche si disponible, sinon année de création du compte.
-- Numérotation séquentielle par (établissement, année), ordonnée par date.
WITH personnel_ordered AS (
  SELECT
    p.id,
    RIGHT(TO_CHAR(COALESCE(p.date_embauche, p.created_at), 'YYYY'), 2) AS yy,
    ROW_NUMBER() OVER (
      PARTITION BY u.etablissement_id,
                   TO_CHAR(COALESCE(p.date_embauche, p.created_at), 'YYYY')
      ORDER BY COALESCE(p.date_embauche, p.created_at), p.id
    ) AS rn,
    etab.code
  FROM "Personnel" p
  JOIN "Utilisateur" u ON u.id = p.utilisateur_id
  JOIN "Etablissement" etab ON etab.id = u.etablissement_id
  WHERE p.matricule IS NULL
)
UPDATE "Personnel" p
SET matricule = po.code || '-P-' || po.yy || '-' || LPAD(po.rn::TEXT, 3, '0')
FROM personnel_ordered po
WHERE p.id = po.id;

CREATE UNIQUE INDEX IF NOT EXISTS "Personnel_matricule_key" ON "Personnel"("matricule");

-- ── 4. Initialiser les séquences au bon point de départ ───────────────────
-- Indispensable : si la séquence repart de 1 alors que des FIC-E-24-001…020
-- existent déjà, le prochain INSERT produirait un doublon.
DO $$
DECLARE
  rec      RECORD;
  seq_name TEXT;
BEGIN
  -- Séquences élèves
  FOR rec IN
    SELECT
      e.etablissement_id,
      SPLIT_PART(e.matricule, '-', 3) AS yy,
      MAX(CAST(SPLIT_PART(e.matricule, '-', 4) AS BIGINT)) AS max_num
    FROM "Eleve" e
    WHERE e.matricule ~ '^[A-Z0-9]{2,4}-E-[0-9]{2}-[0-9]+$'
    GROUP BY e.etablissement_id, SPLIT_PART(e.matricule, '-', 3)
  LOOP
    seq_name := 'seq_mat_e_'
      || REPLACE(rec.etablissement_id::text, '-', '_')
      || '_' || rec.yy;
    EXECUTE format(
      'CREATE SEQUENCE IF NOT EXISTS %I START %s INCREMENT 1',
      seq_name, rec.max_num + 1
    );
  END LOOP;

  -- Séquences personnel
  FOR rec IN
    SELECT
      u.etablissement_id,
      SPLIT_PART(p.matricule, '-', 3) AS yy,
      MAX(CAST(SPLIT_PART(p.matricule, '-', 4) AS BIGINT)) AS max_num
    FROM "Personnel" p
    JOIN "Utilisateur" u ON u.id = p.utilisateur_id
    WHERE p.matricule ~ '^[A-Z0-9]{2,4}-P-[0-9]{2}-[0-9]+$'
    GROUP BY u.etablissement_id, SPLIT_PART(p.matricule, '-', 3)
  LOOP
    seq_name := 'seq_mat_p_'
      || REPLACE(rec.etablissement_id::text, '-', '_')
      || '_' || rec.yy;
    EXECUTE format(
      'CREATE SEQUENCE IF NOT EXISTS %I START %s INCREMENT 1',
      seq_name, rec.max_num + 1
    );
  END LOOP;
END $$;
