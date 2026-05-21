-- Migration: Champs contrat/stage/poste sur Professeur
-- Ajoute les champs nécessaires pour pré-remplir les certificats de travail et attestations.

ALTER TABLE "Professeur" ADD COLUMN "poste_fr"         TEXT;
ALTER TABLE "Professeur" ADD COLUMN "date_fin_contrat" TIMESTAMP(3);
ALTER TABLE "Professeur" ADD COLUMN "date_debut_stage" TIMESTAMP(3);
ALTER TABLE "Professeur" ADD COLUMN "date_fin_stage"   TIMESTAMP(3);
