-- Migration: Civilité du/de la directeur·trice
-- Permet d'accorder en genre les documents générés ("Je soussigné(e)", "Le/La Directeur(trice)").

ALTER TABLE "Etablissement" ADD COLUMN "civilite_directeur" TEXT;
