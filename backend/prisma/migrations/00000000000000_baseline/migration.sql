-- CreateEnum
CREATE TYPE "TypeDocument" AS ENUM ('CERTIFICAT_SCOLARITE', 'ATTESTATION_INSCRIPTION', 'CONVOCATION_EXAMEN', 'FICHE_TRANSFERT', 'EMPLOI_DU_TEMPS_ELEVE', 'RELEVE_NOTES', 'CERTIFICAT_BONNE_CONDUITE', 'FICHE_RENSEIGNEMENTS', 'ATTESTATION_RESULTATS', 'LISTE_CLASSE', 'RELEVE_NOTES_CLASSE', 'RELEVE_NOTES_VIERGE', 'ATTESTATION_TRAVAIL', 'ORDRE_MISSION', 'FICHE_PAIE', 'PLANNING_COURS', 'CERTIFICAT_TRAVAIL_PERMANENT', 'CERTIFICAT_TRAVAIL_STAGIAIRE', 'ATTESTATION_SERVICE', 'AUTORISATION_ABSENCE_ELEVE', 'AUTORISATION_ABSENCE_PERSONNEL', 'CONVOCATION_PARENT', 'BILLET_ENTREE', 'CARTE_ELEVE', 'CARTE_PROFESSEUR');

-- CreateTable
CREATE TABLE "Etablissement" (
    "id" TEXT NOT NULL,
    "nom_fr" TEXT NOT NULL,
    "adresse" TEXT,
    "telephone" TEXT,
    "logo_url" TEXT,
    "signature_url" TEXT,
    "cachet_url" TEXT,
    "nom_directeur" TEXT,
    "civilite_directeur" TEXT,
    "directeur_id" TEXT,
    "code" TEXT NOT NULL,
    "devise" TEXT NOT NULL DEFAULT 'FCFA',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Etablissement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "libelle_fr" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "nom_fr" TEXT NOT NULL,
    "prenom_fr" TEXT,
    "sexe" TEXT,
    "identifiant" TEXT NOT NULL,
    "email" TEXT,
    "mot_de_passe" TEXT NOT NULL,
    "langue" TEXT NOT NULL DEFAULT 'fr',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "last_login" TIMESTAMP(3),
    "tentatives_connexion" INTEGER NOT NULL DEFAULT 0,
    "verrouille_jusqu" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fonction" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle_fr" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "supprimable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fonction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Personnel" (
    "id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "fonction" TEXT NOT NULL DEFAULT 'ENSEIGNANT',
    "specialite_fr" TEXT,
    "telephone" TEXT,
    "date_embauche" TIMESTAMP(3),
    "type_contrat" TEXT NOT NULL DEFAULT 'permanent',
    "salaire_base" DECIMAL(10,2),
    "photo_url" TEXT,
    "matricule" TEXT,
    "qr_token" TEXT,
    "poste_fr" TEXT,
    "date_fin_contrat" TIMESTAMP(3),
    "date_debut_stage" TIMESTAMP(3),
    "date_fin_stage" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Personnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonnelCarte" (
    "id" TEXT NOT NULL,
    "personnel_id" TEXT NOT NULL,
    "uid_nfc" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonnelCarte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pointage" (
    "id" TEXT NOT NULL,
    "personnel_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "horodatage" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uid_carte" TEXT NOT NULL,
    "valide" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Pointage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeureTravail" (
    "id" TEXT NOT NULL,
    "personnel_id" TEXT NOT NULL,
    "date_jour" DATE NOT NULL,
    "heure_arrivee" TIMESTAMP(3),
    "heure_depart" TIMESTAMP(3),
    "duree_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeureTravail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresencePersonnel" (
    "id" TEXT NOT NULL,
    "personnel_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "statut" TEXT NOT NULL,
    "heure_arrivee" TEXT,
    "heure_depart" TEXT,
    "heures_prevues" DECIMAL(4,2),
    "heures_reelles" DECIMAL(4,2),
    "motif" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manuel',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresencePersonnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaiementPersonnel" (
    "id" TEXT NOT NULL,
    "personnel_id" TEXT NOT NULL,
    "mois" INTEGER NOT NULL,
    "annee" INTEGER NOT NULL,
    "heures_theoriques" DECIMAL(6,2),
    "heures_reelles" DECIMAL(6,2),
    "montant_brut" DECIMAL(12,2) NOT NULL,
    "retenues" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_a_payer" DECIMAL(12,2) NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaiementPersonnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnneeScolaire" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnneeScolaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarif" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle_fr" TEXT NOT NULL,
    "description" TEXT,
    "montant_defaut" DECIMAL(10,2) NOT NULL,
    "periodicite" TEXT NOT NULL DEFAULT 'ponctuel',
    "obligatoire" BOOLEAN NOT NULL DEFAULT true,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tarif_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigNotes" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "note_max" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "note_min" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "nb_periodes" INTEGER NOT NULL DEFAULT 3,
    "noms_periodes" JSONB NOT NULL DEFAULT '{"fr":["1er Trimestre","2ème Trimestre","3ème Trimestre"]}',
    "arrondi" INTEGER NOT NULL DEFAULT 2,
    "chiffres_arabes" BOOLEAN NOT NULL DEFAULT false,
    "montant_mensualite" DECIMAL(10,2) NOT NULL DEFAULT 7500,
    "seuil_absences_alerte" INTEGER NOT NULL DEFAULT 3,
    "seuil_note_insuffisante" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "seuil_tres_bien" DECIMAL(5,2) NOT NULL DEFAULT 16,
    "seuil_bien" DECIMAL(5,2) NOT NULL DEFAULT 14,
    "seuil_assez_bien" DECIMAL(5,2) NOT NULL DEFAULT 12,
    "seuil_passable" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "jours_cours" JSONB NOT NULL DEFAULT '["lundi","mardi","mercredi","jeudi","vendredi"]',
    "notif_paiement_retard" BOOLEAN NOT NULL DEFAULT true,
    "notif_absences_eleves" BOOLEAN NOT NULL DEFAULT true,
    "notif_messages" BOOLEAN NOT NULL DEFAULT true,
    "notif_inscriptions" BOOLEAN NOT NULL DEFAULT false,
    "autoriser_toutes_matieres" BOOLEAN NOT NULL DEFAULT false,
    "autoriser_toutes_classes" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigNotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Domaine" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "nom_fr" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Domaine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matiere" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "nom_fr" TEXT NOT NULL,
    "nom_ar" TEXT,
    "filiere" TEXT NOT NULL,
    "coeff_defaut" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "note_min" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "ordre_bulletin" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "domaine_id" TEXT,
    "type_note" TEXT NOT NULL DEFAULT 'SIMPLE',
    "code_court" TEXT,

    CONSTRAINT "Matiere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Niveau" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "groupe_grille" TEXT NOT NULL DEFAULT 'AUTRE',

    CONSTRAINT "Niveau_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classe" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "annee_scolaire_id" TEXT NOT NULL,
    "nom_fr" TEXT NOT NULL,
    "filiere" TEXT NOT NULL,
    "niveau_id" TEXT,
    "capacite" INTEGER NOT NULL DEFAULT 30,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Classe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClasseMatiere" (
    "id" TEXT NOT NULL,
    "classe_id" TEXT NOT NULL,
    "matiere_id" TEXT NOT NULL,
    "coeff_override" DECIMAL(4,2),
    "ordre_override" INTEGER,
    "note_max_override" DECIMAL(5,2),

    CONSTRAINT "ClasseMatiere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClasseMatierePeriode" (
    "id" TEXT NOT NULL,
    "classe_id" TEXT NOT NULL,
    "matiere_id" TEXT NOT NULL,
    "periode" INTEGER NOT NULL,
    "coeff" DECIMAL(4,2) NOT NULL,
    "note_max" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClasseMatierePeriode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonnelMatiereClasse" (
    "id" TEXT NOT NULL,
    "personnel_id" TEXT NOT NULL,
    "classe_id" TEXT NOT NULL,
    "matiere_id" TEXT NOT NULL,
    "annee_scolaire_id" TEXT NOT NULL,

    CONSTRAINT "PersonnelMatiereClasse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Eleve" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "nom_fr" TEXT NOT NULL,
    "prenom_fr" TEXT NOT NULL,
    "date_naissance" DATE NOT NULL,
    "lieu_naissance" TEXT,
    "sexe" TEXT NOT NULL,
    "photo_url" TEXT,
    "qr_token" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Eleve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parent" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "nom_fr" TEXT NOT NULL,
    "lien" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "email" TEXT,
    "adresse" TEXT,

    CONSTRAINT "Parent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inscription" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "classe_fr_id" TEXT,
    "classe_ar_id" TEXT,
    "annee_scolaire_id" TEXT NOT NULL,
    "date_inscription" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaiementEleve" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "inscription_id" TEXT,
    "type" TEXT NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "mois" INTEGER,
    "annee" INTEGER,
    "statut" TEXT NOT NULL DEFAULT 'paye',
    "recu_numero" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaiementEleve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "matiere_id" TEXT NOT NULL,
    "periode" INTEGER NOT NULL,
    "annee_scolaire_id" TEXT NOT NULL,
    "valeur" DECIMAL(5,2) NOT NULL,
    "commentaire" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entite_id" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bulletin" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "annee_scolaire_id" TEXT NOT NULL,
    "filiere" TEXT NOT NULL,
    "periode" INTEGER NOT NULL,
    "moyenne" DECIMAL(5,2),
    "rang" INTEGER,
    "appreciation" TEXT,
    "observation_fr" TEXT,
    "observation_prof" TEXT,
    "valide_par" TEXT,
    "valide_le" TIMESTAMP(3),
    "pdf_url" TEXT,
    "generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bulletin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbsenceEleve" (
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbsenceEleve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creneau" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "annee_scolaire_id" TEXT NOT NULL,
    "classe_id" TEXT NOT NULL,
    "matiere_id" TEXT NOT NULL,
    "personnel_id" TEXT NOT NULL,
    "jour" TEXT NOT NULL,
    "heure_debut" TEXT NOT NULL,
    "heure_fin" TEXT NOT NULL,
    "salle" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creneau_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvenementCalendrier" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "titre_fr" TEXT NOT NULL,
    "description" TEXT,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "couleur" TEXT NOT NULL DEFAULT '#3B82F6',
    "createur_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvenementCalendrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "destinataire_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "entite_type" TEXT,
    "entite_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "sujet" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'individuel',
    "cibles_roles" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "derniere_lecture" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageConversation" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "expediteur_id" TEXT NOT NULL,
    "corps" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortailParentToken" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortailParentToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "classe_id" TEXT NOT NULL,
    "matiere_id" TEXT NOT NULL,
    "annee_scolaire_id" TEXT NOT NULL,
    "periode" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "coefficient" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "note_max" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteEvaluation" (
    "id" TEXT NOT NULL,
    "evaluation_id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "valeur" DECIMAL(5,2),
    "absent" BOOLEAN NOT NULL DEFAULT false,
    "commentaire" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressionEleve" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "annee_scolaire_id" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "decision_auto" TEXT,
    "note_directeur" TEXT,
    "validee" BOOLEAN NOT NULL DEFAULT false,
    "validee_par" TEXT,
    "validee_le" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressionEleve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activite" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "nom_fr" TEXT NOT NULL,
    "description" TEXT,
    "responsable_id" TEXT,
    "capacite_max" INTEGER,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InscriptionActivite" (
    "id" TEXT NOT NULL,
    "activite_id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "annee_scolaire_id" TEXT NOT NULL,
    "date_inscription" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InscriptionActivite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeanceActivite" (
    "id" TEXT NOT NULL,
    "activite_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "duree_min" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeanceActivite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresenceActivite" (
    "id" TEXT NOT NULL,
    "seance_id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresenceActivite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationActivite" (
    "id" TEXT NOT NULL,
    "inscription_activite_id" TEXT NOT NULL,
    "periode" INTEGER,
    "appreciation" TEXT,
    "note" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationActivite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivreStock" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "isbn" TEXT,
    "titre" TEXT NOT NULL,
    "auteur" TEXT,
    "editeur" TEXT,
    "annee_edition" INTEGER,
    "categorie" TEXT,
    "quantite_totale" INTEGER NOT NULL DEFAULT 1,
    "quantite_dispo" INTEGER NOT NULL DEFAULT 1,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LivreStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Emprunt" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "livre_id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "date_emprunt" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_retour_prevue" DATE NOT NULL,
    "date_retour_effective" DATE,
    "statut" TEXT NOT NULL DEFAULT 'en_cours',
    "cree_par" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Emprunt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "type" "TypeDocument" NOT NULL,
    "nom" TEXT NOT NULL,
    "contenu_html" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentGenere" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "template_id" TEXT,
    "type" "TypeDocument" NOT NULL,
    "destinataire_type" TEXT NOT NULL,
    "destinataire_id" TEXT NOT NULL,
    "genere_par" TEXT NOT NULL,
    "genere_le" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parametres" JSONB,

    CONSTRAINT "DocumentGenere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandeAbsencePersonnel" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "personnel_id" TEXT NOT NULL,
    "date_debut" TIMESTAMP(3) NOT NULL,
    "date_fin" TIMESTAMP(3) NOT NULL,
    "motif" TEXT NOT NULL,
    "type_absence" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "commentaire" TEXT,
    "traite_par" TEXT,
    "traite_le" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemandeAbsencePersonnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mention" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "libelle_fr" TEXT NOT NULL,
    "seuil_min" DECIMAL(5,2) NOT NULL,
    "couleur" TEXT NOT NULL DEFAULT 'info',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Etablissement_code_key" ON "Etablissement"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Role_libelle_fr_key" ON "Role"("libelle_fr");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_identifiant_key" ON "Utilisateur"("identifiant");

-- CreateIndex
CREATE INDEX "Utilisateur_etablissement_id_idx" ON "Utilisateur"("etablissement_id");

-- CreateIndex
CREATE INDEX "Utilisateur_etablissement_id_actif_idx" ON "Utilisateur"("etablissement_id", "actif");

-- CreateIndex
CREATE UNIQUE INDEX "Fonction_etablissement_id_code_key" ON "Fonction"("etablissement_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Personnel_utilisateur_id_key" ON "Personnel"("utilisateur_id");

-- CreateIndex
CREATE UNIQUE INDEX "Personnel_matricule_key" ON "Personnel"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "Personnel_qr_token_key" ON "Personnel"("qr_token");

-- CreateIndex
CREATE UNIQUE INDEX "PersonnelCarte_uid_nfc_key" ON "PersonnelCarte"("uid_nfc");

-- CreateIndex
CREATE UNIQUE INDEX "PresencePersonnel_personnel_id_date_key" ON "PresencePersonnel"("personnel_id", "date");

-- CreateIndex
CREATE INDEX "AnneeScolaire_etablissement_id_idx" ON "AnneeScolaire"("etablissement_id");

-- CreateIndex
CREATE INDEX "AnneeScolaire_etablissement_id_active_idx" ON "AnneeScolaire"("etablissement_id", "active");

-- CreateIndex
CREATE INDEX "Tarif_etablissement_id_actif_idx" ON "Tarif"("etablissement_id", "actif");

-- CreateIndex
CREATE UNIQUE INDEX "Tarif_etablissement_id_code_key" ON "Tarif"("etablissement_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigNotes_etablissement_id_key" ON "ConfigNotes"("etablissement_id");

-- CreateIndex
CREATE INDEX "Domaine_etablissement_id_idx" ON "Domaine"("etablissement_id");

-- CreateIndex
CREATE UNIQUE INDEX "Domaine_etablissement_id_code_key" ON "Domaine"("etablissement_id", "code");

-- CreateIndex
CREATE INDEX "Matiere_etablissement_id_idx" ON "Matiere"("etablissement_id");

-- CreateIndex
CREATE INDEX "Matiere_etablissement_id_active_idx" ON "Matiere"("etablissement_id", "active");

-- CreateIndex
CREATE INDEX "Matiere_domaine_id_idx" ON "Matiere"("domaine_id");

-- CreateIndex
CREATE UNIQUE INDEX "Niveau_etablissement_id_libelle_key" ON "Niveau"("etablissement_id", "libelle");

-- CreateIndex
CREATE INDEX "Classe_etablissement_id_idx" ON "Classe"("etablissement_id");

-- CreateIndex
CREATE INDEX "Classe_etablissement_id_annee_scolaire_id_idx" ON "Classe"("etablissement_id", "annee_scolaire_id");

-- CreateIndex
CREATE UNIQUE INDEX "ClasseMatiere_classe_id_matiere_id_key" ON "ClasseMatiere"("classe_id", "matiere_id");

-- CreateIndex
CREATE INDEX "ClasseMatierePeriode_classe_id_periode_idx" ON "ClasseMatierePeriode"("classe_id", "periode");

-- CreateIndex
CREATE UNIQUE INDEX "ClasseMatierePeriode_classe_id_matiere_id_periode_key" ON "ClasseMatierePeriode"("classe_id", "matiere_id", "periode");

-- CreateIndex
CREATE UNIQUE INDEX "Eleve_matricule_key" ON "Eleve"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "Eleve_qr_token_key" ON "Eleve"("qr_token");

-- CreateIndex
CREATE INDEX "Eleve_etablissement_id_idx" ON "Eleve"("etablissement_id");

-- CreateIndex
CREATE INDEX "Eleve_etablissement_id_actif_idx" ON "Eleve"("etablissement_id", "actif");

-- CreateIndex
CREATE INDEX "Eleve_etablissement_id_nom_fr_idx" ON "Eleve"("etablissement_id", "nom_fr");

-- CreateIndex
CREATE INDEX "PaiementEleve_eleve_id_mois_annee_idx" ON "PaiementEleve"("eleve_id", "mois", "annee");

-- CreateIndex
CREATE INDEX "PaiementEleve_annee_mois_idx" ON "PaiementEleve"("annee", "mois");

-- CreateIndex
CREATE UNIQUE INDEX "Note_eleve_id_matiere_id_periode_annee_scolaire_id_key" ON "Note"("eleve_id", "matiere_id", "periode", "annee_scolaire_id");

-- CreateIndex
CREATE INDEX "AuditLog_etablissement_id_created_at_idx" ON "AuditLog"("etablissement_id", "created_at");

-- CreateIndex
CREATE INDEX "AuditLog_entite_entite_id_idx" ON "AuditLog"("entite", "entite_id");

-- CreateIndex
CREATE UNIQUE INDEX "Bulletin_eleve_id_annee_scolaire_id_filiere_periode_key" ON "Bulletin"("eleve_id", "annee_scolaire_id", "filiere", "periode");

-- CreateIndex
CREATE INDEX "AbsenceEleve_etablissement_id_date_idx" ON "AbsenceEleve"("etablissement_id", "date");

-- CreateIndex
CREATE INDEX "AbsenceEleve_eleve_id_date_idx" ON "AbsenceEleve"("eleve_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceEleve_eleve_id_classe_id_date_key" ON "AbsenceEleve"("eleve_id", "classe_id", "date");

-- CreateIndex
CREATE INDEX "Creneau_etablissement_id_idx" ON "Creneau"("etablissement_id");

-- CreateIndex
CREATE INDEX "Creneau_personnel_id_annee_scolaire_id_idx" ON "Creneau"("personnel_id", "annee_scolaire_id");

-- CreateIndex
CREATE INDEX "Creneau_classe_id_annee_scolaire_id_idx" ON "Creneau"("classe_id", "annee_scolaire_id");

-- CreateIndex
CREATE INDEX "EvenementCalendrier_etablissement_id_idx" ON "EvenementCalendrier"("etablissement_id");

-- CreateIndex
CREATE INDEX "EvenementCalendrier_etablissement_id_date_debut_date_fin_idx" ON "EvenementCalendrier"("etablissement_id", "date_debut", "date_fin");

-- CreateIndex
CREATE INDEX "Notification_destinataire_id_lu_created_at_idx" ON "Notification"("destinataire_id", "lu", "created_at");

-- CreateIndex
CREATE INDEX "Notification_etablissement_id_created_at_idx" ON "Notification"("etablissement_id", "created_at");

-- CreateIndex
CREATE INDEX "Conversation_etablissement_id_updated_at_idx" ON "Conversation"("etablissement_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversation_id_utilisateur_id_key" ON "ConversationParticipant"("conversation_id", "utilisateur_id");

-- CreateIndex
CREATE UNIQUE INDEX "PortailParentToken_token_key" ON "PortailParentToken"("token");

-- CreateIndex
CREATE INDEX "PortailParentToken_etablissement_id_idx" ON "PortailParentToken"("etablissement_id");

-- CreateIndex
CREATE UNIQUE INDEX "PortailParentToken_etablissement_id_eleve_id_key" ON "PortailParentToken"("etablissement_id", "eleve_id");

-- CreateIndex
CREATE INDEX "Evaluation_etablissement_id_idx" ON "Evaluation"("etablissement_id");

-- CreateIndex
CREATE INDEX "Evaluation_classe_id_matiere_id_periode_annee_scolaire_id_idx" ON "Evaluation"("classe_id", "matiere_id", "periode", "annee_scolaire_id");

-- CreateIndex
CREATE UNIQUE INDEX "NoteEvaluation_evaluation_id_eleve_id_key" ON "NoteEvaluation"("evaluation_id", "eleve_id");

-- CreateIndex
CREATE INDEX "ProgressionEleve_etablissement_id_idx" ON "ProgressionEleve"("etablissement_id");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressionEleve_eleve_id_annee_scolaire_id_key" ON "ProgressionEleve"("eleve_id", "annee_scolaire_id");

-- CreateIndex
CREATE INDEX "Activite_etablissement_id_idx" ON "Activite"("etablissement_id");

-- CreateIndex
CREATE INDEX "Activite_etablissement_id_actif_idx" ON "Activite"("etablissement_id", "actif");

-- CreateIndex
CREATE UNIQUE INDEX "InscriptionActivite_activite_id_eleve_id_annee_scolaire_id_key" ON "InscriptionActivite"("activite_id", "eleve_id", "annee_scolaire_id");

-- CreateIndex
CREATE UNIQUE INDEX "PresenceActivite_seance_id_eleve_id_key" ON "PresenceActivite"("seance_id", "eleve_id");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_utilisateur_id_idx" ON "RefreshToken"("utilisateur_id");

-- CreateIndex
CREATE INDEX "LivreStock_etablissement_id_idx" ON "LivreStock"("etablissement_id");

-- CreateIndex
CREATE INDEX "Emprunt_etablissement_id_idx" ON "Emprunt"("etablissement_id");

-- CreateIndex
CREATE INDEX "Emprunt_eleve_id_idx" ON "Emprunt"("eleve_id");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_etablissement_id_type_key" ON "DocumentTemplate"("etablissement_id", "type");

-- CreateIndex
CREATE INDEX "DocumentGenere_etablissement_id_genere_le_idx" ON "DocumentGenere"("etablissement_id", "genere_le");

-- CreateIndex
CREATE INDEX "DemandeAbsencePersonnel_etablissement_id_statut_idx" ON "DemandeAbsencePersonnel"("etablissement_id", "statut");

-- CreateIndex
CREATE INDEX "DemandeAbsencePersonnel_personnel_id_idx" ON "DemandeAbsencePersonnel"("personnel_id");

-- CreateIndex
CREATE INDEX "Mention_etablissement_id_idx" ON "Mention"("etablissement_id");

-- CreateIndex
CREATE UNIQUE INDEX "Mention_etablissement_id_seuil_min_key" ON "Mention"("etablissement_id", "seuil_min");

-- AddForeignKey
ALTER TABLE "Etablissement" ADD CONSTRAINT "Etablissement_directeur_id_fkey" FOREIGN KEY ("directeur_id") REFERENCES "Personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fonction" ADD CONSTRAINT "Fonction_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Personnel" ADD CONSTRAINT "Personnel_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelCarte" ADD CONSTRAINT "PersonnelCarte_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pointage" ADD CONSTRAINT "Pointage_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeureTravail" ADD CONSTRAINT "HeureTravail_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresencePersonnel" ADD CONSTRAINT "PresencePersonnel_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementPersonnel" ADD CONSTRAINT "PaiementPersonnel_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnneeScolaire" ADD CONSTRAINT "AnneeScolaire_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarif" ADD CONSTRAINT "Tarif_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigNotes" ADD CONSTRAINT "ConfigNotes_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Domaine" ADD CONSTRAINT "Domaine_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matiere" ADD CONSTRAINT "Matiere_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matiere" ADD CONSTRAINT "Matiere_domaine_id_fkey" FOREIGN KEY ("domaine_id") REFERENCES "Domaine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Niveau" ADD CONSTRAINT "Niveau_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classe" ADD CONSTRAINT "Classe_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classe" ADD CONSTRAINT "Classe_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classe" ADD CONSTRAINT "Classe_niveau_id_fkey" FOREIGN KEY ("niveau_id") REFERENCES "Niveau"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClasseMatiere" ADD CONSTRAINT "ClasseMatiere_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClasseMatiere" ADD CONSTRAINT "ClasseMatiere_matiere_id_fkey" FOREIGN KEY ("matiere_id") REFERENCES "Matiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelMatiereClasse" ADD CONSTRAINT "PersonnelMatiereClasse_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelMatiereClasse" ADD CONSTRAINT "PersonnelMatiereClasse_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelMatiereClasse" ADD CONSTRAINT "PersonnelMatiereClasse_matiere_id_fkey" FOREIGN KEY ("matiere_id") REFERENCES "Matiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelMatiereClasse" ADD CONSTRAINT "PersonnelMatiereClasse_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Eleve" ADD CONSTRAINT "Eleve_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parent" ADD CONSTRAINT "Parent_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "Eleve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "Eleve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_classe_fr_id_fkey" FOREIGN KEY ("classe_fr_id") REFERENCES "Classe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_classe_ar_id_fkey" FOREIGN KEY ("classe_ar_id") REFERENCES "Classe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscription" ADD CONSTRAINT "Inscription_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementEleve" ADD CONSTRAINT "PaiementEleve_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "Eleve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementEleve" ADD CONSTRAINT "PaiementEleve_inscription_id_fkey" FOREIGN KEY ("inscription_id") REFERENCES "Inscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_matiere_id_fkey" FOREIGN KEY ("matiere_id") REFERENCES "Matiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "Eleve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bulletin" ADD CONSTRAINT "Bulletin_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "Eleve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bulletin" ADD CONSTRAINT "Bulletin_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceEleve" ADD CONSTRAINT "AbsenceEleve_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "Eleve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceEleve" ADD CONSTRAINT "AbsenceEleve_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceEleve" ADD CONSTRAINT "AbsenceEleve_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceEleve" ADD CONSTRAINT "AbsenceEleve_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creneau" ADD CONSTRAINT "Creneau_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creneau" ADD CONSTRAINT "Creneau_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creneau" ADD CONSTRAINT "Creneau_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creneau" ADD CONSTRAINT "Creneau_matiere_id_fkey" FOREIGN KEY ("matiere_id") REFERENCES "Matiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creneau" ADD CONSTRAINT "Creneau_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvenementCalendrier" ADD CONSTRAINT "EvenementCalendrier_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvenementCalendrier" ADD CONSTRAINT "EvenementCalendrier_createur_id_fkey" FOREIGN KEY ("createur_id") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_destinataire_id_fkey" FOREIGN KEY ("destinataire_id") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageConversation" ADD CONSTRAINT "MessageConversation_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageConversation" ADD CONSTRAINT "MessageConversation_expediteur_id_fkey" FOREIGN KEY ("expediteur_id") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortailParentToken" ADD CONSTRAINT "PortailParentToken_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortailParentToken" ADD CONSTRAINT "PortailParentToken_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "Eleve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_matiere_id_fkey" FOREIGN KEY ("matiere_id") REFERENCES "Matiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteEvaluation" ADD CONSTRAINT "NoteEvaluation_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteEvaluation" ADD CONSTRAINT "NoteEvaluation_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "Eleve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionEleve" ADD CONSTRAINT "ProgressionEleve_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionEleve" ADD CONSTRAINT "ProgressionEleve_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "Eleve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionEleve" ADD CONSTRAINT "ProgressionEleve_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activite" ADD CONSTRAINT "Activite_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activite" ADD CONSTRAINT "Activite_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscriptionActivite" ADD CONSTRAINT "InscriptionActivite_activite_id_fkey" FOREIGN KEY ("activite_id") REFERENCES "Activite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscriptionActivite" ADD CONSTRAINT "InscriptionActivite_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "Eleve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscriptionActivite" ADD CONSTRAINT "InscriptionActivite_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeanceActivite" ADD CONSTRAINT "SeanceActivite_activite_id_fkey" FOREIGN KEY ("activite_id") REFERENCES "Activite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceActivite" ADD CONSTRAINT "PresenceActivite_seance_id_fkey" FOREIGN KEY ("seance_id") REFERENCES "SeanceActivite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceActivite" ADD CONSTRAINT "PresenceActivite_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "Eleve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationActivite" ADD CONSTRAINT "EvaluationActivite_inscription_activite_id_fkey" FOREIGN KEY ("inscription_activite_id") REFERENCES "InscriptionActivite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprunt" ADD CONSTRAINT "Emprunt_livre_id_fkey" FOREIGN KEY ("livre_id") REFERENCES "LivreStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emprunt" ADD CONSTRAINT "Emprunt_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "Eleve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentGenere" ADD CONSTRAINT "DocumentGenere_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentGenere" ADD CONSTRAINT "DocumentGenere_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentGenere" ADD CONSTRAINT "DocumentGenere_genere_par_fkey" FOREIGN KEY ("genere_par") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeAbsencePersonnel" ADD CONSTRAINT "DemandeAbsencePersonnel_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeAbsencePersonnel" ADD CONSTRAINT "DemandeAbsencePersonnel_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "Personnel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeAbsencePersonnel" ADD CONSTRAINT "DemandeAbsencePersonnel_traite_par_fkey" FOREIGN KEY ("traite_par") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

