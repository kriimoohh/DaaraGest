-- Multi-établissement (2/2) : isolation des établissements par la base (Row-Level Security).
--
-- Le rôle daaragest_app (sans connexion, sans contournement de la RLS) ne voit et n'écrit que les
-- lignes de l'établissement fixé par set_config('app.etab_id', …). L'application bascule sur ce rôle
-- le temps de chaque transaction d'une requête authentifiée (src/config/database.ts). Le compte de
-- connexion (propriétaire / superutilisateur) n'est PAS soumis aux politiques : migrations, seed,
-- scripts, connexion et portail parent continuent de fonctionner sans changement.
--
-- Toute nouvelle table portant etablissement_id doit recevoir la même politique : un test
-- d'intégration (rls.itest.ts) échoue sinon.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'daaragest_app') THEN
    CREATE ROLE daaragest_app NOLOGIN NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO daaragest_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO daaragest_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO daaragest_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO daaragest_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO daaragest_app;

-- L'établissement lui-même : seule sa propre ligne.
ALTER TABLE "Etablissement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "Etablissement"
  USING ("id" = current_setting('app.etab_id', true))
  WITH CHECK ("id" = current_setting('app.etab_id', true));

ALTER TABLE "AbsenceEleve" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "AbsenceEleve"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "Activite" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "Activite"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "AnneeScolaire" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "AnneeScolaire"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "AuditLog"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "BulletinTemplate" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "BulletinTemplate"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "CahierSeance" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "CahierSeance"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "CahierVisa" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "CahierVisa"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "Classe" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "Classe"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "ConfigNotes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "ConfigNotes"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "Conversation"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "Creneau" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "Creneau"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "DemandeAbsencePersonnel" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "DemandeAbsencePersonnel"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "Devoir" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "Devoir"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "DocumentGenere" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "DocumentGenere"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "DocumentTemplate" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "DocumentTemplate"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "Domaine" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "Domaine"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "Eleve" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "Eleve"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "Emprunt" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "Emprunt"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "Evaluation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "Evaluation"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "EvenementCalendrier" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "EvenementCalendrier"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "Filiere" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "Filiere"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "Fonction" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "Fonction"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "LivreStock" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "LivreStock"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "Matiere" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "Matiere"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "MatriculeCounter" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "MatriculeCounter"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "Mention" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "Mention"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "Niveau" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "Niveau"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "Notification"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "PortailParentToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "PortailParentToken"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "ProgressionEleve" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "ProgressionEleve"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "Tarif" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "Tarif"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));

ALTER TABLE "Utilisateur" ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolation_etablissement ON "Utilisateur"
  USING ("etablissement_id" = current_setting('app.etab_id', true))
  WITH CHECK ("etablissement_id" = current_setting('app.etab_id', true));
