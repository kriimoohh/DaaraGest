-- Politique de saisie des notes par les professeurs.
-- Deux booléens indépendants ajoutés à ConfigNotes.
-- Défaut false/false = comportement strict actuel (aucune école impactée
-- tant qu'un admin ne change rien dans Paramètres).
ALTER TABLE "ConfigNotes"
  ADD COLUMN "autoriser_toutes_matieres" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "autoriser_toutes_classes"  BOOLEAN NOT NULL DEFAULT false;
