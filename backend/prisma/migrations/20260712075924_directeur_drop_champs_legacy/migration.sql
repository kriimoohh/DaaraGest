-- Nettoyage P5 (suite) : le directeur vient désormais de la relation
-- Etablissement.directeur_id → Personnel (sélectionné dans Paramètres).
-- Les champs libres legacy sont supprimés ; vérifié avant merge que la prod
-- a bien directeur_id renseigné.

-- AlterTable
ALTER TABLE "Etablissement" DROP COLUMN "civilite_directeur",
DROP COLUMN "nom_directeur";
