-- AlterTable
ALTER TABLE "Mention" ADD COLUMN     "niveau_id" TEXT,
ADD COLUMN     "libelle_ar" TEXT;

-- DropIndex
DROP INDEX "Mention_etablissement_id_seuil_min_key";

-- CreateIndex
CREATE UNIQUE INDEX "Mention_etablissement_id_niveau_id_seuil_min_key" ON "Mention"("etablissement_id", "niveau_id", "seuil_min");

-- CreateIndex
CREATE INDEX "Mention_niveau_id_idx" ON "Mention"("niveau_id");

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_niveau_id_fkey" FOREIGN KEY ("niveau_id") REFERENCES "Niveau"("id") ON DELETE SET NULL ON UPDATE CASCADE;
