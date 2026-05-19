-- QR Code pour le pointage automatique des professeurs
ALTER TABLE "Professeur"
  ADD COLUMN IF NOT EXISTS "qr_token" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Professeur_qr_token_key" ON "Professeur"("qr_token");

-- Source du pointage (manuel vs QR scan)
ALTER TABLE "PresenceProfesseur"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manuel';
