/*
  Warnings:

  - You are about to drop the column `pdf_url` on the `Bulletin` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Bulletin" DROP COLUMN "pdf_url";

-- AlterTable
ALTER TABLE "ClasseMatiere" ADD COLUMN     "updated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ClasseMatierePeriode" ADD COLUMN     "updated_at" TIMESTAMP(3);
