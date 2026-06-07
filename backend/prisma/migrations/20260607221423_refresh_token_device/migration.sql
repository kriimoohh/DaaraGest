-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "device_id" TEXT;

-- CreateIndex
CREATE INDEX "RefreshToken_utilisateur_id_device_id_idx" ON "RefreshToken"("utilisateur_id", "device_id");
