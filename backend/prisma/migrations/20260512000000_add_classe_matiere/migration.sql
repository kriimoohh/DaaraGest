-- Création de la table ClasseMatiere
-- Chaque classe peut avoir son propre programme de matières.
-- coeff_override surcharge le coeff_defaut de la matière si défini.
-- ordre_override surcharge l'ordre_bulletin de la matière si défini.

CREATE TABLE "ClasseMatiere" (
  "id"             TEXT NOT NULL,
  "classe_id"      TEXT NOT NULL,
  "matiere_id"     TEXT NOT NULL,
  "coeff_override" DECIMAL(4, 2),
  "ordre_override" INTEGER,

  CONSTRAINT "ClasseMatiere_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClasseMatiere_classe_id_fkey"  FOREIGN KEY ("classe_id")  REFERENCES "Classe"("id")  ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClasseMatiere_matiere_id_fkey" FOREIGN KEY ("matiere_id") REFERENCES "Matiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClasseMatiere_classe_id_matiere_id_key" UNIQUE ("classe_id", "matiere_id")
);

CREATE INDEX "ClasseMatiere_classe_id_idx"  ON "ClasseMatiere"("classe_id");
CREATE INDEX "ClasseMatiere_matiere_id_idx" ON "ClasseMatiere"("matiere_id");
