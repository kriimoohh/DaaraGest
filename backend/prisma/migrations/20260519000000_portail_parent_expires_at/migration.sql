-- AlterTable: ajout de la colonne expires_at sur PortailParentToken
ALTER TABLE "PortailParentToken" ADD COLUMN "expires_at" TIMESTAMP(3);
