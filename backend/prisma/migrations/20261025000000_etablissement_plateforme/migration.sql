-- Console de plateforme séparée des écoles : un établissement TECHNIQUE porte les comptes de la
-- plateforme (super-admins). Il n'est jamais listé parmi les écoles et son journal d'audit est le
-- journal de la plateforme. Connexion des comptes plateforme : code école « PLATEFORME ».

ALTER TABLE "Etablissement" ADD COLUMN "est_plateforme" BOOLEAN NOT NULL DEFAULT false;

INSERT INTO "Etablissement" ("id", "nom_fr", "code", "devise", "actif", "est_plateforme", "created_at", "updated_at")
VALUES ('plateforme', 'Plateforme DaaraGest', 'PLATEFORME', 'FCFA', true, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
