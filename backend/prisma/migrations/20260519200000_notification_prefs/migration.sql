-- Préférences de notifications dans ConfigNotes
ALTER TABLE "ConfigNotes"
  ADD COLUMN IF NOT EXISTS "notif_paiement_retard" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notif_absences_eleves" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notif_messages"        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notif_inscriptions"    BOOLEAN NOT NULL DEFAULT false;
