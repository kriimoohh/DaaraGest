-- Add must_change_password field to Utilisateur
ALTER TABLE "Utilisateur" ADD COLUMN IF NOT EXISTS "must_change_password" BOOLEAN NOT NULL DEFAULT false;

-- Add observation fields to Bulletin
ALTER TABLE "Bulletin" ADD COLUMN IF NOT EXISTS "observation_fr" TEXT;
ALTER TABLE "Bulletin" ADD COLUMN IF NOT EXISTS "observation_ar" TEXT;
ALTER TABLE "Bulletin" ADD COLUMN IF NOT EXISTS "observation_prof" TEXT;
ALTER TABLE "Bulletin" ADD COLUMN IF NOT EXISTS "valide_par" TEXT;
ALTER TABLE "Bulletin" ADD COLUMN IF NOT EXISTS "valide_le" TIMESTAMP(3);

-- Create AbsenceEleve table
CREATE TABLE IF NOT EXISTS "AbsenceEleve" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "classe_id" TEXT NOT NULL,
    "annee_scolaire_id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "statut" TEXT NOT NULL,
    "justifiee" BOOLEAN NOT NULL DEFAULT false,
    "motif" TEXT,
    "heure_arrivee" TEXT,
    "cree_par" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbsenceEleve_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "AbsenceEleve_eleve_id_classe_id_date_key"
    ON "AbsenceEleve"("eleve_id", "classe_id", "date");

-- Add foreign key constraints
ALTER TABLE "AbsenceEleve" ADD CONSTRAINT "AbsenceEleve_eleve_id_fkey"
    FOREIGN KEY ("eleve_id") REFERENCES "Eleve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AbsenceEleve" ADD CONSTRAINT "AbsenceEleve_classe_id_fkey"
    FOREIGN KEY ("classe_id") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AbsenceEleve" ADD CONSTRAINT "AbsenceEleve_annee_scolaire_id_fkey"
    FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AbsenceEleve" ADD CONSTRAINT "AbsenceEleve_etablissement_id_fkey"
    FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
