-- Création de la table MatiereClasse
-- Permet d'assigner explicitement les matières à une classe en début d'année,
-- indépendamment de l'affectation des professeurs (ProfMatiereClasse).
-- C'est la source de vérité pour le programme d'une classe, utilisée par les bulletins.

CREATE TABLE "MatiereClasse" (
  "id"                TEXT NOT NULL,
  "matiere_id"        TEXT NOT NULL,
  "classe_id"         TEXT NOT NULL,
  "annee_scolaire_id" TEXT NOT NULL,

  CONSTRAINT "MatiereClasse_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MatiereClasse_matiere_id_fkey"        FOREIGN KEY ("matiere_id")        REFERENCES "Matiere"("id")        ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MatiereClasse_classe_id_fkey"         FOREIGN KEY ("classe_id")         REFERENCES "Classe"("id")         ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MatiereClasse_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id")   ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MatiereClasse_matiere_classe_annee_unique" UNIQUE ("matiere_id", "classe_id", "annee_scolaire_id")
);
