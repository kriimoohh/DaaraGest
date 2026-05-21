-- Add nom_directeur to Etablissement
ALTER TABLE "Etablissement" ADD COLUMN "nom_directeur" TEXT;

-- Add new TypeDocument enum values
ALTER TYPE "TypeDocument" ADD VALUE 'CERTIFICAT_TRAVAIL_PERMANENT';
ALTER TYPE "TypeDocument" ADD VALUE 'CERTIFICAT_TRAVAIL_STAGIAIRE';
ALTER TYPE "TypeDocument" ADD VALUE 'ATTESTATION_SERVICE';
ALTER TYPE "TypeDocument" ADD VALUE 'AUTORISATION_ABSENCE_ELEVE';
ALTER TYPE "TypeDocument" ADD VALUE 'BILLET_ENTREE';

-- Create DemandeAbsenceProfesseur table
CREATE TABLE "DemandeAbsenceProfesseur" (
    "id"               TEXT         NOT NULL,
    "etablissement_id" TEXT         NOT NULL,
    "professeur_id"    TEXT         NOT NULL,
    "date_debut"       TIMESTAMP(3) NOT NULL,
    "date_fin"         TIMESTAMP(3) NOT NULL,
    "motif"            TEXT         NOT NULL,
    "type_absence"     TEXT         NOT NULL,
    "statut"           TEXT         NOT NULL DEFAULT 'EN_ATTENTE',
    "commentaire"      TEXT,
    "traite_par"       TEXT,
    "traite_le"        TIMESTAMP(3),
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DemandeAbsenceProfesseur_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DemandeAbsenceProfesseur_etablissement_id_statut_idx"
    ON "DemandeAbsenceProfesseur"("etablissement_id", "statut");

CREATE INDEX "DemandeAbsenceProfesseur_professeur_id_idx"
    ON "DemandeAbsenceProfesseur"("professeur_id");

ALTER TABLE "DemandeAbsenceProfesseur"
    ADD CONSTRAINT "DemandeAbsenceProfesseur_etablissement_id_fkey"
    FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DemandeAbsenceProfesseur"
    ADD CONSTRAINT "DemandeAbsenceProfesseur_professeur_id_fkey"
    FOREIGN KEY ("professeur_id") REFERENCES "Professeur"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DemandeAbsenceProfesseur"
    ADD CONSTRAINT "DemandeAbsenceProfesseur_traite_par_fkey"
    FOREIGN KEY ("traite_par") REFERENCES "Utilisateur"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
