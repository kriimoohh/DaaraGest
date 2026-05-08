-- CreateTable
CREATE TABLE "Etablissement" (
    "id" TEXT NOT NULL,
    "nom_fr" TEXT NOT NULL,
    "adresse" TEXT,
    "telephone" TEXT,
    "logo_url" TEXT,
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
    "nom_ar" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mot_de_passe" TEXT NOT NULL,
    "langue" TEXT NOT NULL DEFAULT 'fr',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Professeur" (
    "id" TEXT NOT NULL,
    "utilisateur_id" TEXT NOT NULL,
    "specialite_fr" TEXT,
    "specialite_ar" TEXT,
    "telephone" TEXT,
    "date_embauche" TIMESTAMP(3),
    "type_contrat" TEXT NOT NULL DEFAULT 'permanent',
    "salaire_base" DECIMAL(10,2),
    "photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Professeur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfesseurCarte" (
    "id" TEXT NOT NULL,
    "professeur_id" TEXT NOT NULL,
    "uid_nfc" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfesseurCarte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pointage" (
    "id" TEXT NOT NULL,
    "professeur_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "horodatage" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uid_carte" TEXT NOT NULL,
    "valide" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Pointage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeureTravail" (
    "id" TEXT NOT NULL,
    "professeur_id" TEXT NOT NULL,
    "date_jour" DATE NOT NULL,
    "heure_arrivee" TIMESTAMP(3),
    "heure_depart" TIMESTAMP(3),
    "duree_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeureTravail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaiementProfesseur" (
    "id" TEXT NOT NULL,
    "professeur_id" TEXT NOT NULL,
    "mois" INTEGER NOT NULL,
    "annee" INTEGER NOT NULL,
    "heures_theoriques" DECIMAL(6,2),
    "heures_reelles" DECIMAL(6,2),
    "montant_brut" DECIMAL(12,2) NOT NULL,
    "retenues" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_a_payer" DECIMAL(12,2) NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'en_attente',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaiementProfesseur_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "ConfigNotes" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "note_max" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "note_min" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "nb_periodes" INTEGER NOT NULL DEFAULT 3,
    "noms_periodes" JSONB NOT NULL DEFAULT '{"fr":["1er Trimestre","2ème Trimestre","3ème Trimestre"],"ar":["الفصل الأول","الفصل الثاني","الفصل الثالث"]}',
    "arrondi" INTEGER NOT NULL DEFAULT 2,
    "chiffres_arabes" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigNotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matiere" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "nom_fr" TEXT NOT NULL,
    "nom_ar" TEXT NOT NULL,
    "filiere" TEXT NOT NULL,
    "coeff_defaut" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "ordre_bulletin" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Matiere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classe" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "annee_scolaire_id" TEXT NOT NULL,
    "nom_fr" TEXT NOT NULL,
    "nom_ar" TEXT NOT NULL,
    "filiere" TEXT NOT NULL,
    "niveau" TEXT NOT NULL,
    "capacite" INTEGER NOT NULL DEFAULT 30,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Classe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfMatiereClasse" (
    "id" TEXT NOT NULL,
    "professeur_id" TEXT NOT NULL,
    "classe_id" TEXT NOT NULL,
    "matiere_id" TEXT NOT NULL,
    "annee_scolaire_id" TEXT NOT NULL,
    "coefficient" DECIMAL(4,2) NOT NULL DEFAULT 1,

    CONSTRAINT "ProfMatiereClasse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Eleve" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "nom_fr" TEXT NOT NULL,
    "prenom_fr" TEXT NOT NULL,
    "date_naissance" DATE NOT NULL,
    "sexe" TEXT NOT NULL,
    "photo_url" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Eleve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parent" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "nom_fr" TEXT NOT NULL,
    "nom_ar" TEXT,
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
CREATE TABLE "Bulletin" (
    "id" TEXT NOT NULL,
    "eleve_id" TEXT NOT NULL,
    "annee_scolaire_id" TEXT NOT NULL,
    "filiere" TEXT NOT NULL,
    "periode" INTEGER NOT NULL,
    "moyenne" DECIMAL(5,2),
    "rang" INTEGER,
    "appreciation" TEXT,
    "pdf_url" TEXT,
    "generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bulletin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_libelle_fr_key" ON "Role"("libelle_fr");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_email_key" ON "Utilisateur"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Professeur_utilisateur_id_key" ON "Professeur"("utilisateur_id");

-- CreateIndex
CREATE UNIQUE INDEX "ProfesseurCarte_uid_nfc_key" ON "ProfesseurCarte"("uid_nfc");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigNotes_etablissement_id_key" ON "ConfigNotes"("etablissement_id");

-- CreateIndex
CREATE UNIQUE INDEX "Eleve_matricule_key" ON "Eleve"("matricule");

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Professeur" ADD CONSTRAINT "Professeur_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfesseurCarte" ADD CONSTRAINT "ProfesseurCarte_professeur_id_fkey" FOREIGN KEY ("professeur_id") REFERENCES "Professeur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pointage" ADD CONSTRAINT "Pointage_professeur_id_fkey" FOREIGN KEY ("professeur_id") REFERENCES "Professeur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeureTravail" ADD CONSTRAINT "HeureTravail_professeur_id_fkey" FOREIGN KEY ("professeur_id") REFERENCES "Professeur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaiementProfesseur" ADD CONSTRAINT "PaiementProfesseur_professeur_id_fkey" FOREIGN KEY ("professeur_id") REFERENCES "Professeur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnneeScolaire" ADD CONSTRAINT "AnneeScolaire_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigNotes" ADD CONSTRAINT "ConfigNotes_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matiere" ADD CONSTRAINT "Matiere_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classe" ADD CONSTRAINT "Classe_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classe" ADD CONSTRAINT "Classe_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfMatiereClasse" ADD CONSTRAINT "ProfMatiereClasse_professeur_id_fkey" FOREIGN KEY ("professeur_id") REFERENCES "Professeur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfMatiereClasse" ADD CONSTRAINT "ProfMatiereClasse_classe_id_fkey" FOREIGN KEY ("classe_id") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfMatiereClasse" ADD CONSTRAINT "ProfMatiereClasse_matiere_id_fkey" FOREIGN KEY ("matiere_id") REFERENCES "Matiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfMatiereClasse" ADD CONSTRAINT "ProfMatiereClasse_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "Bulletin" ADD CONSTRAINT "Bulletin_eleve_id_fkey" FOREIGN KEY ("eleve_id") REFERENCES "Eleve"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bulletin" ADD CONSTRAINT "Bulletin_annee_scolaire_id_fkey" FOREIGN KEY ("annee_scolaire_id") REFERENCES "AnneeScolaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
