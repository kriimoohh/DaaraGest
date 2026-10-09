-- Version de session : incrémentée quand les droits ou le mot de passe d'un compte changent
-- (désactivation, réinitialisation, changement de rôle, changement de mot de passe). Elle est portée
-- par le jeton d'accès ; un jeton dont la version ne correspond plus est refusé immédiatement.
ALTER TABLE "Utilisateur" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
