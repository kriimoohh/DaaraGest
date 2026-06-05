-- Ajout de deux nouveaux types de documents :
--   RELEVE_NOTES_CLASSE : relevé de notes pré-rempli pour une classe (A4 paysage)
--   RELEVE_NOTES_VIERGE : version vierge à imprimer pour saisie manuscrite
--
-- IMPORTANT : sous PostgreSQL, ALTER TYPE ... ADD VALUE ne peut pas être
-- exécuté dans le même bloc transactionnel qu'un usage de la nouvelle valeur.
-- Le DO $$ BEGIN/EXCEPTION protège contre une seconde exécution.

DO $$ BEGIN
  ALTER TYPE "TypeDocument" ADD VALUE IF NOT EXISTS 'RELEVE_NOTES_CLASSE';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TYPE "TypeDocument" ADD VALUE IF NOT EXISTS 'RELEVE_NOTES_VIERGE';
EXCEPTION WHEN duplicate_object THEN null; END $$;
