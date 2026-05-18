-- Table PresenceProfesseur (pointage manuel des professeurs)
CREATE TABLE IF NOT EXISTS "PresenceProfesseur" (
  "id"              TEXT NOT NULL,
  "professeur_id"   TEXT NOT NULL,
  "date"            DATE NOT NULL,
  "statut"          TEXT NOT NULL,
  "heure_arrivee"   TEXT,
  "heure_depart"    TEXT,
  "heures_prevues"  NUMERIC(4,2),
  "heures_reelles"  NUMERIC(4,2),
  "motif"           TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PresenceProfesseur_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PresenceProfesseur_professeur_id_date_key" UNIQUE ("professeur_id", "date"),
  CONSTRAINT "PresenceProfesseur_professeur_id_fkey" FOREIGN KEY ("professeur_id")
    REFERENCES "Professeur"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
