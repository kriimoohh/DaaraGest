-- Ajout des colonnes manquantes dans ConfigNotes
ALTER TABLE "ConfigNotes"
  ADD COLUMN IF NOT EXISTS "seuil_absences_alerte" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "jours_cours" JSONB NOT NULL DEFAULT '["lundi","mardi","mercredi","jeudi","vendredi"]';

-- Table Creneau (emploi du temps)
CREATE TABLE IF NOT EXISTS "Creneau" (
  "id"                TEXT NOT NULL,
  "etablissement_id"  TEXT NOT NULL,
  "annee_scolaire_id" TEXT NOT NULL,
  "classe_id"         TEXT NOT NULL,
  "matiere_id"        TEXT NOT NULL,
  "professeur_id"     TEXT NOT NULL,
  "jour"              TEXT NOT NULL,
  "heure_debut"       TEXT NOT NULL,
  "heure_fin"         TEXT NOT NULL,
  "salle"             TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Creneau_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Creneau_etablissement_id_fkey"  FOREIGN KEY ("etablissement_id")  REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Creneau_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Creneau_classe_id_fkey"         FOREIGN KEY ("classe_id")         REFERENCES "Classe"("id")        ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Creneau_matiere_id_fkey"        FOREIGN KEY ("matiere_id")        REFERENCES "Matiere"("id")        ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Creneau_professeur_id_fkey"     FOREIGN KEY ("professeur_id")     REFERENCES "Professeur"("id")    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Table EvenementCalendrier
CREATE TABLE IF NOT EXISTS "EvenementCalendrier" (
  "id"               TEXT NOT NULL,
  "etablissement_id" TEXT NOT NULL,
  "titre_fr"         TEXT NOT NULL,
  "titre_ar"         TEXT,
  "description"      TEXT,
  "date_debut"       DATE NOT NULL,
  "date_fin"         DATE NOT NULL,
  "type"             TEXT NOT NULL,
  "couleur"          TEXT NOT NULL DEFAULT '#3B82F6',
  "createur_id"      TEXT NOT NULL,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EvenementCalendrier_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EvenementCalendrier_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EvenementCalendrier_createur_id_fkey"      FOREIGN KEY ("createur_id")      REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Table Notification
CREATE TABLE IF NOT EXISTS "Notification" (
  "id"               TEXT NOT NULL,
  "etablissement_id" TEXT NOT NULL,
  "destinataire_id"  TEXT NOT NULL,
  "type"             TEXT NOT NULL,
  "titre"            TEXT NOT NULL,
  "message"          TEXT NOT NULL,
  "lu"               BOOLEAN NOT NULL DEFAULT false,
  "entite_type"      TEXT,
  "entite_id"        TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Notification_destinataire_id_fkey"  FOREIGN KEY ("destinataire_id")  REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
