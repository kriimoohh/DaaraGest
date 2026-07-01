-- AlterTable
ALTER TABLE "ConfigNotes" ADD COLUMN     "bulletin_afficher_rang" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bulletin_afficher_absences" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bulletin_logo_echelle" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "bulletin_police_echelle" INTEGER NOT NULL DEFAULT 100;
