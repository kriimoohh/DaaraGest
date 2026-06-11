-- AlterTable
ALTER TABLE "Classe" ADD COLUMN     "code" TEXT;

-- CreateIndex
CREATE INDEX "Classe_etablissement_id_code_idx" ON "Classe"("etablissement_id", "code");
