-- Phase 3.1 - Évaluations formatives
CREATE TABLE IF NOT EXISTS "Evaluation" (
  "id"                TEXT        NOT NULL,
  "etablissement_id"  TEXT        NOT NULL,
  "classe_id"         TEXT        NOT NULL,
  "matiere_id"        TEXT        NOT NULL,
  "annee_scolaire_id" TEXT        NOT NULL,
  "periode"           INTEGER     NOT NULL,
  "titre"             TEXT        NOT NULL,
  "type"              TEXT        NOT NULL,
  "date"              DATE        NOT NULL,
  "coefficient"       NUMERIC(4,2) NOT NULL DEFAULT 1,
  "note_max"          NUMERIC(5,2) NOT NULL DEFAULT 20,
  "created_by"        TEXT        NOT NULL,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Evaluation_pkey"                   PRIMARY KEY ("id"),
  CONSTRAINT "Evaluation_etablissement_id_fkey"  FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Evaluation_classe_id_fkey"         FOREIGN KEY ("classe_id")        REFERENCES "Classe"("id")        ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Evaluation_matiere_id_fkey"        FOREIGN KEY ("matiere_id")       REFERENCES "Matiere"("id")       ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Evaluation_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "NoteEvaluation" (
  "id"            TEXT         NOT NULL,
  "evaluation_id" TEXT         NOT NULL,
  "eleve_id"      TEXT         NOT NULL,
  "valeur"        NUMERIC(5,2),
  "absent"        BOOLEAN      NOT NULL DEFAULT false,
  "commentaire"   TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NoteEvaluation_pkey"              PRIMARY KEY ("id"),
  CONSTRAINT "NoteEvaluation_evaluation_id_key" UNIQUE ("evaluation_id", "eleve_id"),
  CONSTRAINT "NoteEvaluation_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NoteEvaluation_eleve_id_fkey"      FOREIGN KEY ("eleve_id")      REFERENCES "Eleve"("id")      ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Phase 3.2 - Progression élève
CREATE TABLE IF NOT EXISTS "ProgressionEleve" (
  "id"                TEXT         NOT NULL,
  "etablissement_id"  TEXT         NOT NULL,
  "eleve_id"          TEXT         NOT NULL,
  "annee_scolaire_id" TEXT         NOT NULL,
  "decision"          TEXT         NOT NULL,
  "decision_auto"     TEXT,
  "note_directeur"    TEXT,
  "validee"           BOOLEAN      NOT NULL DEFAULT false,
  "validee_par"       TEXT,
  "validee_le"        TIMESTAMP(3),
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProgressionEleve_pkey"                      PRIMARY KEY ("id"),
  CONSTRAINT "ProgressionEleve_eleve_annee_key"           UNIQUE ("eleve_id", "annee_scolaire_id"),
  CONSTRAINT "ProgressionEleve_etablissement_id_fkey"     FOREIGN KEY ("etablissement_id")  REFERENCES "Etablissement"("id")  ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProgressionEleve_eleve_id_fkey"             FOREIGN KEY ("eleve_id")          REFERENCES "Eleve"("id")          ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProgressionEleve_annee_scolaire_id_fkey"    FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Phase 3.3 - Activités parascolaires
CREATE TABLE IF NOT EXISTS "Activite" (
  "id"               TEXT         NOT NULL,
  "etablissement_id" TEXT         NOT NULL,
  "nom_fr"           TEXT         NOT NULL,
  "nom_ar"           TEXT,
  "description"      TEXT,
  "responsable_id"   TEXT,
  "capacite_max"     INTEGER,
  "actif"            BOOLEAN      NOT NULL DEFAULT true,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Activite_pkey"               PRIMARY KEY ("id"),
  CONSTRAINT "Activite_etab_fkey"          FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Activite_responsable_fkey"   FOREIGN KEY ("responsable_id")   REFERENCES "Utilisateur"("id")   ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "InscriptionActivite" (
  "id"                TEXT         NOT NULL,
  "activite_id"       TEXT         NOT NULL,
  "eleve_id"          TEXT         NOT NULL,
  "annee_scolaire_id" TEXT         NOT NULL,
  "date_inscription"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InscriptionActivite_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "InscriptionActivite_unique_key"  UNIQUE ("activite_id", "eleve_id", "annee_scolaire_id"),
  CONSTRAINT "InscriptionActivite_activite_fkey"       FOREIGN KEY ("activite_id")       REFERENCES "Activite"("id")      ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InscriptionActivite_eleve_fkey"          FOREIGN KEY ("eleve_id")          REFERENCES "Eleve"("id")         ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InscriptionActivite_annee_fkey"          FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SeanceActivite" (
  "id"          TEXT         NOT NULL,
  "activite_id" TEXT         NOT NULL,
  "date"        DATE         NOT NULL,
  "duree_min"   INTEGER,
  "notes"       TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SeanceActivite_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "SeanceActivite_activite_fkey" FOREIGN KEY ("activite_id") REFERENCES "Activite"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PresenceActivite" (
  "id"         TEXT         NOT NULL,
  "seance_id"  TEXT         NOT NULL,
  "eleve_id"   TEXT         NOT NULL,
  "statut"     TEXT         NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PresenceActivite_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "PresenceActivite_unique_key"  UNIQUE ("seance_id", "eleve_id"),
  CONSTRAINT "PresenceActivite_seance_fkey" FOREIGN KEY ("seance_id") REFERENCES "SeanceActivite"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PresenceActivite_eleve_fkey"  FOREIGN KEY ("eleve_id")  REFERENCES "Eleve"("id")          ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "EvaluationActivite" (
  "id"                      TEXT         NOT NULL,
  "inscription_activite_id" TEXT         NOT NULL,
  "periode"                 INTEGER,
  "appreciation"            TEXT,
  "note"                    NUMERIC(5,2),
  "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EvaluationActivite_pkey"               PRIMARY KEY ("id"),
  CONSTRAINT "EvaluationActivite_inscription_fkey"   FOREIGN KEY ("inscription_activite_id") REFERENCES "InscriptionActivite"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
