-- Multi-établissement (1/2) : l'identifiant de connexion devient unique PAR établissement
-- (deux écoles peuvent avoir chacune un compte « admin ») et ajout du drapeau super-admin plateforme.
-- Sans risque sur les données existantes : un identifiant unique globalement l'est a fortiori par école.

-- AlterTable
ALTER TABLE "Utilisateur" ADD COLUMN "super_admin" BOOLEAN NOT NULL DEFAULT false;

-- L'index composite remplace l'index simple sur etablissement_id (il en couvre le préfixe).
CREATE UNIQUE INDEX "Utilisateur_etablissement_id_identifiant_key" ON "Utilisateur"("etablissement_id", "identifiant");
DROP INDEX "Utilisateur_etablissement_id_idx";
DROP INDEX "Utilisateur_identifiant_key";
