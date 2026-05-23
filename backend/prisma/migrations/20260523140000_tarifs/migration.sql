-- Migration: Catalogue de tarifs configurables par établissement
-- Permet de définir les frais facturables aux familles : mensualité (existante),
-- inscription, examens, uniforme, transport, cantine, ou tout tarif personnalisé.
-- La table ne casse pas l'existant : PaiementEleve.type reste un String libre.

CREATE TABLE "Tarif" (
  "id"               TEXT NOT NULL,
  "etablissement_id" TEXT NOT NULL,
  "code"             TEXT NOT NULL,
  "libelle_fr"       TEXT NOT NULL,
  "description"      TEXT,
  "montant_defaut"   DECIMAL(10, 2) NOT NULL,
  "periodicite"      TEXT NOT NULL DEFAULT 'ponctuel',
  "obligatoire"      BOOLEAN NOT NULL DEFAULT true,
  "actif"            BOOLEAN NOT NULL DEFAULT true,
  "ordre"            INTEGER NOT NULL DEFAULT 0,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Tarif_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tarif_etablissement_id_code_key"
  ON "Tarif"("etablissement_id", "code");

CREATE INDEX "Tarif_etablissement_id_actif_idx"
  ON "Tarif"("etablissement_id", "actif");

ALTER TABLE "Tarif"
  ADD CONSTRAINT "Tarif_etablissement_id_fkey"
  FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed : crée le tarif MENSUALITE pour chaque établissement existant, en reprenant
-- le montant courant de ConfigNotes.montant_mensualite. Le champ legacy reste utilisé
-- par getReliquats() jusqu'à migration applicative complète.
INSERT INTO "Tarif" ("id", "etablissement_id", "code", "libelle_fr", "montant_defaut",
                     "periodicite", "obligatoire", "actif", "ordre", "updated_at")
SELECT
  gen_random_uuid()::TEXT,
  c."etablissement_id",
  'MENSUALITE',
  'Mensualité',
  c."montant_mensualite",
  'mensuel',
  true,
  true,
  0,
  CURRENT_TIMESTAMP
FROM "ConfigNotes" c
WHERE NOT EXISTS (
  SELECT 1 FROM "Tarif" t
  WHERE t."etablissement_id" = c."etablissement_id" AND t."code" = 'MENSUALITE'
);
