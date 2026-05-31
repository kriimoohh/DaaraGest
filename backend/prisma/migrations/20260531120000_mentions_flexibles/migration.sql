-- CreateTable
CREATE TABLE "Mention" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "libelle_fr" TEXT NOT NULL,
    "seuil_min" DECIMAL(5,2) NOT NULL,
    "couleur" TEXT NOT NULL DEFAULT 'info',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mention_etablissement_id_seuil_min_key" ON "Mention"("etablissement_id", "seuil_min");

-- CreateIndex
CREATE INDEX "Mention_etablissement_id_idx" ON "Mention"("etablissement_id");

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default mentions from existing ConfigNotes for all establishments
-- This converts the 4 fixed thresholds into flexible Mention rows.
INSERT INTO "Mention" ("id", "etablissement_id", "libelle_fr", "seuil_min", "couleur", "ordre", "is_system")
SELECT
    gen_random_uuid(),
    e.id,
    'Très bien',
    COALESCE(cn.seuil_tres_bien, 16),
    'success',
    1,
    false
FROM "Etablissement" e
LEFT JOIN "ConfigNotes" cn ON cn.etablissement_id = e.id
ON CONFLICT DO NOTHING;

INSERT INTO "Mention" ("id", "etablissement_id", "libelle_fr", "seuil_min", "couleur", "ordre", "is_system")
SELECT
    gen_random_uuid(),
    e.id,
    'Bien',
    COALESCE(cn.seuil_bien, 14),
    'info',
    2,
    false
FROM "Etablissement" e
LEFT JOIN "ConfigNotes" cn ON cn.etablissement_id = e.id
ON CONFLICT DO NOTHING;

INSERT INTO "Mention" ("id", "etablissement_id", "libelle_fr", "seuil_min", "couleur", "ordre", "is_system")
SELECT
    gen_random_uuid(),
    e.id,
    'Assez bien',
    COALESCE(cn.seuil_assez_bien, 12),
    'info',
    3,
    false
FROM "Etablissement" e
LEFT JOIN "ConfigNotes" cn ON cn.etablissement_id = e.id
ON CONFLICT DO NOTHING;

INSERT INTO "Mention" ("id", "etablissement_id", "libelle_fr", "seuil_min", "couleur", "ordre", "is_system")
SELECT
    gen_random_uuid(),
    e.id,
    'Passable',
    COALESCE(cn.seuil_passable, 10),
    'warning',
    4,
    false
FROM "Etablissement" e
LEFT JOIN "ConfigNotes" cn ON cn.etablissement_id = e.id
ON CONFLICT DO NOTHING;

INSERT INTO "Mention" ("id", "etablissement_id", "libelle_fr", "seuil_min", "couleur", "ordre", "is_system")
SELECT
    gen_random_uuid(),
    e.id,
    'Insuffisant',
    0,
    'error',
    99,
    true
FROM "Etablissement" e
ON CONFLICT DO NOTHING;
