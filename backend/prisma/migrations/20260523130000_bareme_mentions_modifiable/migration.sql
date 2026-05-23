-- Migration: Barème des mentions modifiable
-- Ajoute 4 seuils paramétrables (par établissement) pour le calcul des
-- mentions sur les bulletins et rapports. Le seuil "Insuffisant" reste
-- implicite (toute note < seuil_passable). Valeurs par défaut conformes
-- au barème historique hardcodé : 16 / 14 / 12 / 10.

ALTER TABLE "ConfigNotes"
  ADD COLUMN "seuil_tres_bien"  DECIMAL(5, 2) NOT NULL DEFAULT 16,
  ADD COLUMN "seuil_bien"       DECIMAL(5, 2) NOT NULL DEFAULT 14,
  ADD COLUMN "seuil_assez_bien" DECIMAL(5, 2) NOT NULL DEFAULT 12,
  ADD COLUMN "seuil_passable"   DECIMAL(5, 2) NOT NULL DEFAULT 10;
