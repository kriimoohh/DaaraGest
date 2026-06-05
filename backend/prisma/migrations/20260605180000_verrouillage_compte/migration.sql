-- Verrouillage de compte après échecs de connexion répétés (anti brute-force,
-- robuste multi-instances car persisté en base plutôt qu'en mémoire process).
ALTER TABLE "Utilisateur" ADD COLUMN "tentatives_connexion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Utilisateur" ADD COLUMN "verrouille_jusqu" TIMESTAMP(3);
