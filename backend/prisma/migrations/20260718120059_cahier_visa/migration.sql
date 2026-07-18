-- CreateTable
CREATE TABLE "CahierVisa" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "annee_scolaire_id" TEXT NOT NULL,
    "classe_id" TEXT NOT NULL,
    "du" DATE NOT NULL,
    "au" DATE NOT NULL,
    "vise_par" TEXT NOT NULL,
    "vise_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commentaire" TEXT,

    CONSTRAINT "CahierVisa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CahierVisa_classe_id_annee_scolaire_id_du_au_idx" ON "CahierVisa"("classe_id", "annee_scolaire_id", "du", "au");

-- AddForeignKey
ALTER TABLE "CahierVisa" ADD CONSTRAINT "CahierVisa_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CahierVisa" ADD CONSTRAINT "CahierVisa_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CahierVisa" ADD CONSTRAINT "CahierVisa_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CahierVisa" ADD CONSTRAINT "CahierVisa_vise_par_fkey" FOREIGN KEY ("vise_par") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
