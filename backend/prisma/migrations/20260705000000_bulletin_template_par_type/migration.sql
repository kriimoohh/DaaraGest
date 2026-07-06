-- AlterTable : ajoute `type` (défaut temporaire pour couvrir d'éventuelles lignes, puis retiré)
ALTER TABLE "BulletinTemplate" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'FR';
ALTER TABLE "BulletinTemplate" ALTER COLUMN "type" DROP DEFAULT;

-- DropIndex : ancien unique par établissement
DROP INDEX "BulletinTemplate_etablissement_id_key";

-- CreateIndex : nouvel unique par (établissement, type)
CREATE UNIQUE INDEX "BulletinTemplate_etablissement_id_type_key" ON "BulletinTemplate"("etablissement_id", "type");
