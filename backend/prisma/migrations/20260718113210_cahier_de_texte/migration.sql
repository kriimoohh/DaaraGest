-- CreateTable
CREATE TABLE "CahierSeance" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "annee_scolaire_id" TEXT NOT NULL,
    "classe_id" TEXT NOT NULL,
    "matiere_id" TEXT NOT NULL,
    "personnel_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "creneau_id" TEXT,
    "contenu" TEXT NOT NULL,
    "objectif" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CahierSeance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Devoir" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "annee_scolaire_id" TEXT NOT NULL,
    "classe_id" TEXT NOT NULL,
    "matiere_id" TEXT NOT NULL,
    "personnel_id" TEXT NOT NULL,
    "donne_le" DATE NOT NULL,
    "pour_le" DATE NOT NULL,
    "consigne" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'EXERCICE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Devoir_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CahierSeance_classe_id_annee_scolaire_id_date_idx" ON "CahierSeance"("classe_id", "annee_scolaire_id", "date");

-- CreateIndex
CREATE INDEX "CahierSeance_personnel_id_date_idx" ON "CahierSeance"("personnel_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CahierSeance_classe_id_matiere_id_date_creneau_id_key" ON "CahierSeance"("classe_id", "matiere_id", "date", "creneau_id");

-- CreateIndex
CREATE INDEX "Devoir_classe_id_annee_scolaire_id_pour_le_idx" ON "Devoir"("classe_id", "annee_scolaire_id", "pour_le");

-- CreateIndex
CREATE INDEX "Devoir_personnel_id_donne_le_idx" ON "Devoir"("personnel_id", "donne_le");

-- AddForeignKey
ALTER TABLE "CahierSeance" ADD CONSTRAINT "CahierSeance_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CahierSeance" ADD CONSTRAINT "CahierSeance_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CahierSeance" ADD CONSTRAINT "CahierSeance_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CahierSeance" ADD CONSTRAINT "CahierSeance_matiere_id_fkey" FOREIGN KEY ("matiere_id") REFERENCES "Matiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CahierSeance" ADD CONSTRAINT "CahierSeance_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devoir" ADD CONSTRAINT "Devoir_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devoir" ADD CONSTRAINT "Devoir_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devoir" ADD CONSTRAINT "Devoir_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devoir" ADD CONSTRAINT "Devoir_matiere_id_fkey" FOREIGN KEY ("matiere_id") REFERENCES "Matiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devoir" ADD CONSTRAINT "Devoir_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
