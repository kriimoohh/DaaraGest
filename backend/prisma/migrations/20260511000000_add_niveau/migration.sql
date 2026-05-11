-- Création de la table Niveau
-- Remplace le champ texte libre `niveau` dans Classe par une FK vers cette table.
-- Gérable par l'admin depuis les Paramètres.

CREATE TABLE "Niveau" (
  "id"               TEXT NOT NULL,
  "etablissement_id" TEXT NOT NULL,
  "libelle"          TEXT NOT NULL,
  "ordre"            INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "Niveau_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Niveau_etablissement_id_fkey" FOREIGN KEY ("etablissement_id")
    REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Niveau_etablissement_id_libelle_key" UNIQUE ("etablissement_id", "libelle")
);

-- Ajout de niveau_id (nullable) sur Classe
ALTER TABLE "Classe" ADD COLUMN "niveau_id" TEXT;

ALTER TABLE "Classe" ADD CONSTRAINT "Classe_niveau_id_fkey"
  FOREIGN KEY ("niveau_id") REFERENCES "Niveau"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Suppression de l'ancien champ texte libre
ALTER TABLE "Classe" DROP COLUMN IF EXISTS "niveau";
