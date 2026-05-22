-- Migration: Table Fonction (catalogue configurable par établissement)
-- Permet d'ajouter/modifier/supprimer les fonctions du personnel depuis
-- Paramètres. Les 7 fonctions par défaut sont seedées plus bas avec
-- supprimable=false pour éviter qu'elles disparaissent par accident.

CREATE TABLE "Fonction" (
    "id"               TEXT         NOT NULL,
    "etablissement_id" TEXT         NOT NULL,
    "code"             TEXT         NOT NULL,
    "libelle_fr"       TEXT         NOT NULL,
    "libelle_ar"       TEXT,
    "ordre"            INTEGER      NOT NULL DEFAULT 0,
    "supprimable"      BOOLEAN      NOT NULL DEFAULT true,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Fonction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Fonction_etablissement_id_code_key"
    ON "Fonction"("etablissement_id", "code");

ALTER TABLE "Fonction"
    ADD CONSTRAINT "Fonction_etablissement_id_fkey"
    FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed des fonctions par défaut pour tous les établissements existants.
-- gen_random_uuid() est disponible via pgcrypto (présent par défaut sur Railway/Postgres récents).
INSERT INTO "Fonction" ("id", "etablissement_id", "code", "libelle_fr", "libelle_ar", "ordre", "supprimable")
SELECT gen_random_uuid(), e."id", v.code, v.libelle_fr, v.libelle_ar, v.ordre, false
FROM "Etablissement" e
CROSS JOIN (VALUES
    ('ENSEIGNANT',      'Enseignant',             'مدرّس',         1),
    ('DIRECTEUR',       'Directeur / Directrice', 'مدير / مديرة',  2),
    ('SURVEILLANT',     'Surveillant',            'مراقب',         3),
    ('AGENT_SCOLARITE', 'Agent de scolarité',     'موظف الإدارة',  4),
    ('COMPTABLE',       'Comptable',              'محاسب',         5),
    ('INTENDANT',       'Intendant',              'مشرف الشؤون',   6),
    ('AUTRE',           'Autre',                  'أخرى',          7)
) AS v(code, libelle_fr, libelle_ar, ordre);
