-- Description FR lisible du journal d'audit, calculée à l'écriture.
-- Nullable : les lignes existantes n'en ont pas (le front les rend malgré tout
-- via action + entité + détails), pas de backfill nécessaire.
ALTER TABLE "AuditLog" ADD COLUMN "description" TEXT;
