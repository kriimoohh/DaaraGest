-- Migration: domaines_grilles
-- Ajout du modèle Domaine, extension Matiere (domaine_id, type_note, code_court),
-- extension Niveau (groupe_grille) pour les grilles d'évaluation IEF.

-- 1. Modèle Domaine (domaines pédagogiques : LC, Maths, ESVS, EPSA, Autre)
CREATE TABLE "Domaine" (
    "id"               TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "nom_fr"           TEXT NOT NULL,
    "nom_ar"           TEXT NOT NULL DEFAULT '',
    "code"             TEXT NOT NULL,
    "ordre"            INTEGER NOT NULL DEFAULT 0,
    "actif"            BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Domaine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Domaine_etablissement_id_code_key"
    ON "Domaine"("etablissement_id", "code");

CREATE INDEX "Domaine_etablissement_id_idx"
    ON "Domaine"("etablissement_id");

ALTER TABLE "Domaine"
    ADD CONSTRAINT "Domaine_etablissement_id_fkey"
    FOREIGN KEY ("etablissement_id")
    REFERENCES "Etablissement"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Extension Matiere : domaine_id (FK optionnel), type_note, code_court
ALTER TABLE "Matiere"
    ADD COLUMN "domaine_id"  TEXT,
    ADD COLUMN "type_note"   TEXT NOT NULL DEFAULT 'SIMPLE',
    ADD COLUMN "code_court"  TEXT;

CREATE INDEX "Matiere_domaine_id_idx" ON "Matiere"("domaine_id");

ALTER TABLE "Matiere"
    ADD CONSTRAINT "Matiere_domaine_id_fkey"
    FOREIGN KEY ("domaine_id")
    REFERENCES "Domaine"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Extension Niveau : groupe_grille
ALTER TABLE "Niveau"
    ADD COLUMN "groupe_grille" TEXT NOT NULL DEFAULT 'AUTRE';
