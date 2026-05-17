-- Colonne manquante dans ConfigNotes (oubliée dans la migration précédente)
ALTER TABLE "ConfigNotes"
  ADD COLUMN IF NOT EXISTS "seuil_note_insuffisante" NUMERIC(5,2) NOT NULL DEFAULT 10;
