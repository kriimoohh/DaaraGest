-- Phase 2d (finale) de la refonte filières : la colonne string historique
-- `filiere` disparaît de Classe et Matiere ; `filiere_id` (FK → Filiere)
-- devient obligatoire. Bulletin.filiere est CONSERVÉE (sémantique différente :
-- type du bulletin FR/AR/EN/COMBINE/ANNUEL).
--
-- Filet de sécurité : backfill de filiere_id depuis le code string pour
-- d'éventuelles lignes retardataires, AVANT le SET NOT NULL (qui échouerait
-- sinon — garde naturelle de la migration).

UPDATE "Matiere" m SET "filiere_id" = f."id"
FROM "Filiere" f
WHERE m."filiere_id" IS NULL
  AND f."etablissement_id" = m."etablissement_id"
  AND f."code" = m."filiere";

UPDATE "Classe" c SET "filiere_id" = f."id"
FROM "Filiere" f
WHERE c."filiere_id" IS NULL
  AND f."etablissement_id" = c."etablissement_id"
  AND f."code" = c."filiere";

-- DropForeignKey
ALTER TABLE "Classe" DROP CONSTRAINT "Classe_filiere_id_fkey";

-- DropForeignKey
ALTER TABLE "Matiere" DROP CONSTRAINT "Matiere_filiere_id_fkey";

-- AlterTable
ALTER TABLE "Classe" DROP COLUMN "filiere",
ALTER COLUMN "filiere_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "Matiere" DROP COLUMN "filiere",
ALTER COLUMN "filiere_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Matiere" ADD CONSTRAINT "Matiere_filiere_id_fkey" FOREIGN KEY ("filiere_id") REFERENCES "Filiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classe" ADD CONSTRAINT "Classe_filiere_id_fkey" FOREIGN KEY ("filiere_id") REFERENCES "Filiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
