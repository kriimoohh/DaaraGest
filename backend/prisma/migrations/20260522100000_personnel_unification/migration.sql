-- Migration: Unification Professeur → Personnel
-- Renomme la table Professeur en Personnel et ajoute le champ `fonction` pour
-- couvrir tous les types de personnel (enseignant, directeur, surveillant,
-- agent de scolarité, comptable, intendant, autre). Les tables liées sont
-- renommées en parallèle pour la cohérence sémantique.
--
-- 525 élèves, 22 classes, 4 utilisateurs sur etablissement-default — aucune
-- donnée d'enseignant en prod (1 prof unique). Risque maîtrisé.

-- ─── 1. Ajout colonne fonction ──────────────────────────────────────────────
ALTER TABLE "Professeur" ADD COLUMN "fonction" TEXT NOT NULL DEFAULT 'ENSEIGNANT';

-- ─── 2. Renommage table principale ──────────────────────────────────────────
ALTER TABLE "Professeur" RENAME TO "Personnel";

-- ─── 3. Renommage tables liées ──────────────────────────────────────────────
ALTER TABLE "ProfesseurCarte"          RENAME TO "PersonnelCarte";
ALTER TABLE "PresenceProfesseur"       RENAME TO "PresencePersonnel";
ALTER TABLE "PaiementProfesseur"       RENAME TO "PaiementPersonnel";
ALTER TABLE "ProfMatiereClasse"        RENAME TO "PersonnelMatiereClasse";
ALTER TABLE "DemandeAbsenceProfesseur" RENAME TO "DemandeAbsencePersonnel";

-- ─── 4. Renommage colonnes FK professeur_id → personnel_id ──────────────────
ALTER TABLE "PersonnelCarte"          RENAME COLUMN "professeur_id" TO "personnel_id";
ALTER TABLE "Pointage"                RENAME COLUMN "professeur_id" TO "personnel_id";
ALTER TABLE "HeureTravail"            RENAME COLUMN "professeur_id" TO "personnel_id";
ALTER TABLE "PresencePersonnel"       RENAME COLUMN "professeur_id" TO "personnel_id";
ALTER TABLE "PaiementPersonnel"       RENAME COLUMN "professeur_id" TO "personnel_id";
ALTER TABLE "PersonnelMatiereClasse"  RENAME COLUMN "professeur_id" TO "personnel_id";
ALTER TABLE "Creneau"                 RENAME COLUMN "professeur_id" TO "personnel_id";
ALTER TABLE "DemandeAbsencePersonnel" RENAME COLUMN "professeur_id" TO "personnel_id";

-- ─── 5. Renommage contraintes pkey, fkey, index ─────────────────────────────
ALTER TABLE "Personnel" RENAME CONSTRAINT "Professeur_pkey" TO "Personnel_pkey";
ALTER INDEX "Professeur_utilisateur_id_key" RENAME TO "Personnel_utilisateur_id_key";
ALTER INDEX "Professeur_qr_token_key"       RENAME TO "Personnel_qr_token_key";

ALTER TABLE "Personnel" RENAME CONSTRAINT "Professeur_utilisateur_id_fkey" TO "Personnel_utilisateur_id_fkey";

ALTER TABLE "PersonnelCarte" RENAME CONSTRAINT "ProfesseurCarte_pkey"                   TO "PersonnelCarte_pkey";
ALTER INDEX "ProfesseurCarte_uid_nfc_key"                                                RENAME TO "PersonnelCarte_uid_nfc_key";
ALTER TABLE "PersonnelCarte" RENAME CONSTRAINT "ProfesseurCarte_professeur_id_fkey"     TO "PersonnelCarte_personnel_id_fkey";

ALTER TABLE "Pointage"     RENAME CONSTRAINT "Pointage_professeur_id_fkey"     TO "Pointage_personnel_id_fkey";
ALTER TABLE "HeureTravail" RENAME CONSTRAINT "HeureTravail_professeur_id_fkey" TO "HeureTravail_personnel_id_fkey";

ALTER TABLE "PresencePersonnel" RENAME CONSTRAINT "PresenceProfesseur_pkey"                       TO "PresencePersonnel_pkey";
ALTER INDEX  "PresenceProfesseur_professeur_id_date_key"                                          RENAME TO "PresencePersonnel_personnel_id_date_key";
ALTER TABLE "PresencePersonnel" RENAME CONSTRAINT "PresenceProfesseur_professeur_id_fkey"         TO "PresencePersonnel_personnel_id_fkey";

ALTER TABLE "PaiementPersonnel" RENAME CONSTRAINT "PaiementProfesseur_pkey"               TO "PaiementPersonnel_pkey";
ALTER TABLE "PaiementPersonnel" RENAME CONSTRAINT "PaiementProfesseur_professeur_id_fkey" TO "PaiementPersonnel_personnel_id_fkey";

ALTER TABLE "PersonnelMatiereClasse" RENAME CONSTRAINT "ProfMatiereClasse_pkey"                    TO "PersonnelMatiereClasse_pkey";
ALTER TABLE "PersonnelMatiereClasse" RENAME CONSTRAINT "ProfMatiereClasse_professeur_id_fkey"      TO "PersonnelMatiereClasse_personnel_id_fkey";
ALTER TABLE "PersonnelMatiereClasse" RENAME CONSTRAINT "ProfMatiereClasse_classe_id_fkey"          TO "PersonnelMatiereClasse_classe_id_fkey";
ALTER TABLE "PersonnelMatiereClasse" RENAME CONSTRAINT "ProfMatiereClasse_matiere_id_fkey"         TO "PersonnelMatiereClasse_matiere_id_fkey";
ALTER TABLE "PersonnelMatiereClasse" RENAME CONSTRAINT "ProfMatiereClasse_annee_scolaire_id_fkey"  TO "PersonnelMatiereClasse_annee_scolaire_id_fkey";

ALTER INDEX "Creneau_professeur_id_annee_scolaire_id_idx" RENAME TO "Creneau_personnel_id_annee_scolaire_id_idx";
ALTER TABLE "Creneau" RENAME CONSTRAINT "Creneau_professeur_id_fkey" TO "Creneau_personnel_id_fkey";

ALTER TABLE "DemandeAbsencePersonnel" RENAME CONSTRAINT "DemandeAbsenceProfesseur_pkey"                       TO "DemandeAbsencePersonnel_pkey";
ALTER INDEX  "DemandeAbsenceProfesseur_etablissement_id_statut_idx"                                            RENAME TO "DemandeAbsencePersonnel_etablissement_id_statut_idx";
ALTER INDEX  "DemandeAbsenceProfesseur_professeur_id_idx"                                                     RENAME TO "DemandeAbsencePersonnel_personnel_id_idx";
ALTER TABLE "DemandeAbsencePersonnel" RENAME CONSTRAINT "DemandeAbsenceProfesseur_etablissement_id_fkey"      TO "DemandeAbsencePersonnel_etablissement_id_fkey";
ALTER TABLE "DemandeAbsencePersonnel" RENAME CONSTRAINT "DemandeAbsenceProfesseur_professeur_id_fkey"         TO "DemandeAbsencePersonnel_personnel_id_fkey";
ALTER TABLE "DemandeAbsencePersonnel" RENAME CONSTRAINT "DemandeAbsenceProfesseur_traite_par_fkey"            TO "DemandeAbsencePersonnel_traite_par_fkey";

-- ─── 6. Etablissement.directeur_id ──────────────────────────────────────────
ALTER TABLE "Etablissement" ADD COLUMN "directeur_id" TEXT;
ALTER TABLE "Etablissement"
    ADD CONSTRAINT "Etablissement_directeur_id_fkey"
    FOREIGN KEY ("directeur_id") REFERENCES "Personnel"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
