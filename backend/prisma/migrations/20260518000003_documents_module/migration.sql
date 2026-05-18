-- Add signature/cachet to Etablissement
ALTER TABLE "Etablissement" ADD COLUMN IF NOT EXISTS "signature_url" TEXT;
ALTER TABLE "Etablissement" ADD COLUMN IF NOT EXISTS "cachet_url" TEXT;

-- TypeDocument enum
DO $$ BEGIN
  CREATE TYPE "TypeDocument" AS ENUM (
    'CERTIFICAT_SCOLARITE', 'ATTESTATION_INSCRIPTION', 'CONVOCATION_EXAMEN',
    'FICHE_TRANSFERT', 'EMPLOI_DU_TEMPS_ELEVE', 'RELEVE_NOTES',
    'CERTIFICAT_BONNE_CONDUITE', 'FICHE_RENSEIGNEMENTS', 'ATTESTATION_RESULTATS',
    'LISTE_CLASSE', 'ATTESTATION_TRAVAIL', 'ORDRE_MISSION', 'FICHE_PAIE', 'PLANNING_COURS'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- DocumentTemplate
CREATE TABLE IF NOT EXISTS "DocumentTemplate" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "etablissement_id" TEXT NOT NULL,
  "type" "TypeDocument" NOT NULL,
  "nom" TEXT NOT NULL,
  "contenu_html" TEXT NOT NULL,
  "actif" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentTemplate_etablissement_id_type_key" UNIQUE ("etablissement_id", "type"),
  CONSTRAINT "DocumentTemplate_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- DocumentGenere
CREATE TABLE IF NOT EXISTS "DocumentGenere" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "etablissement_id" TEXT NOT NULL,
  "template_id" TEXT,
  "type" "TypeDocument" NOT NULL,
  "destinataire_type" TEXT NOT NULL,
  "destinataire_id" TEXT NOT NULL,
  "genere_par" TEXT NOT NULL,
  "genere_le" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "parametres" JSONB,
  CONSTRAINT "DocumentGenere_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentGenere_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DocumentGenere_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "DocumentGenere_genere_par_fkey" FOREIGN KEY ("genere_par") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
