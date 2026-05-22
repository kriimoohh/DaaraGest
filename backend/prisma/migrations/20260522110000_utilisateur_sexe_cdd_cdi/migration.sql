-- Migration: Sexe sur Utilisateur (pour accord en genre des documents)
-- Le champ type_contrat reste un TEXT libre côté DB ; les valeurs autorisées
-- (permanent, vacataire, stagiaire, CDD, CDI) sont contraintes côté API (Zod).

ALTER TABLE "Utilisateur" ADD COLUMN "sexe" TEXT;
