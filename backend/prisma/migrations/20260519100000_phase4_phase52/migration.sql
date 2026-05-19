-- Phase 5.2 — Refresh tokens
CREATE TABLE "RefreshToken" (
    "id"             TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "token"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "expires_at"     TIMESTAMP(3) NOT NULL,
    "revoked"        BOOLEAN NOT NULL DEFAULT false,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");
CREATE INDEX "RefreshToken_utilisateur_id_idx" ON "RefreshToken"("utilisateur_id");

ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_utilisateur_id_fkey"
    FOREIGN KEY ("utilisateur_id") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 4.3 — Bibliothèque scolaire
CREATE TABLE "LivreStock" (
    "id"               TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "isbn"             TEXT,
    "titre"            TEXT NOT NULL,
    "auteur"           TEXT,
    "editeur"          TEXT,
    "annee_edition"    INTEGER,
    "categorie"        TEXT,
    "quantite_totale"  INTEGER NOT NULL DEFAULT 1,
    "quantite_dispo"   INTEGER NOT NULL DEFAULT 1,
    "actif"            BOOLEAN NOT NULL DEFAULT true,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LivreStock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LivreStock_etablissement_id_idx" ON "LivreStock"("etablissement_id");

CREATE TABLE "Emprunt" (
    "id"                    TEXT NOT NULL,
    "etablissement_id"      TEXT NOT NULL,
    "livre_id"              TEXT NOT NULL,
    "eleve_id"              TEXT NOT NULL,
    "date_emprunt"          DATE NOT NULL DEFAULT CURRENT_DATE,
    "date_retour_prevue"    DATE NOT NULL,
    "date_retour_effective" DATE,
    "statut"                TEXT NOT NULL DEFAULT 'en_cours',
    "cree_par"              TEXT NOT NULL,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Emprunt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Emprunt_etablissement_id_idx" ON "Emprunt"("etablissement_id");
CREATE INDEX "Emprunt_eleve_id_idx" ON "Emprunt"("eleve_id");

ALTER TABLE "Emprunt" ADD CONSTRAINT "Emprunt_livre_id_fkey"
    FOREIGN KEY ("livre_id") REFERENCES "LivreStock"("id") ON UPDATE CASCADE;

ALTER TABLE "Emprunt" ADD CONSTRAINT "Emprunt_eleve_id_fkey"
    FOREIGN KEY ("eleve_id") REFERENCES "Eleve"("id") ON UPDATE CASCADE;
