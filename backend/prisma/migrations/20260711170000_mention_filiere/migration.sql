-- Mentions personnalisables par filière (Phase 2).
-- filiere_id nullable (null = toutes filières = comportement historique).
ALTER TABLE "Mention" ADD COLUMN "filiere_id" TEXT;

-- L'unicité passe de (etab, niveau, seuil) à (etab, filiere, niveau, seuil).
DROP INDEX "Mention_etablissement_id_niveau_id_seuil_min_key";
CREATE UNIQUE INDEX "Mention_etablissement_id_filiere_id_niveau_id_seuil_min_key"
  ON "Mention"("etablissement_id", "filiere_id", "niveau_id", "seuil_min");

CREATE INDEX "Mention_filiere_id_idx" ON "Mention"("filiere_id");

ALTER TABLE "Mention"
  ADD CONSTRAINT "Mention_filiere_id_fkey"
  FOREIGN KEY ("filiere_id") REFERENCES "Filiere"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
