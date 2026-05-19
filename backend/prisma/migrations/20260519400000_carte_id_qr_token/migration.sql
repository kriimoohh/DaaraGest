-- Migration: Carte ID + QR token élève
-- Adds qr_token to Eleve and two new TypeDocument enum values

ALTER TABLE "Eleve" ADD COLUMN "qr_token" TEXT;
CREATE UNIQUE INDEX "Eleve_qr_token_key" ON "Eleve"("qr_token");

ALTER TYPE "TypeDocument" ADD VALUE 'CARTE_ELEVE';
ALTER TYPE "TypeDocument" ADD VALUE 'CARTE_PROFESSEUR';
