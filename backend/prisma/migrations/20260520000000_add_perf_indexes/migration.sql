-- Indexes de performance multi-tenant (audit E2).
-- Le scale par etablissement_id était full-table-scan sur ~14 modèles.

-- Utilisateur
CREATE INDEX "Utilisateur_etablissement_id_idx" ON "Utilisateur"("etablissement_id");
CREATE INDEX "Utilisateur_etablissement_id_actif_idx" ON "Utilisateur"("etablissement_id", "actif");

-- AnneeScolaire
CREATE INDEX "AnneeScolaire_etablissement_id_idx" ON "AnneeScolaire"("etablissement_id");
CREATE INDEX "AnneeScolaire_etablissement_id_active_idx" ON "AnneeScolaire"("etablissement_id", "active");

-- Matiere
CREATE INDEX "Matiere_etablissement_id_idx" ON "Matiere"("etablissement_id");
CREATE INDEX "Matiere_etablissement_id_active_idx" ON "Matiere"("etablissement_id", "active");

-- Classe
CREATE INDEX "Classe_etablissement_id_idx" ON "Classe"("etablissement_id");
CREATE INDEX "Classe_etablissement_id_annee_scolaire_id_idx" ON "Classe"("etablissement_id", "annee_scolaire_id");

-- Eleve
CREATE INDEX "Eleve_etablissement_id_idx" ON "Eleve"("etablissement_id");
CREATE INDEX "Eleve_etablissement_id_actif_idx" ON "Eleve"("etablissement_id", "actif");
CREATE INDEX "Eleve_etablissement_id_nom_fr_idx" ON "Eleve"("etablissement_id", "nom_fr");

-- PaiementEleve
CREATE INDEX "PaiementEleve_eleve_id_mois_annee_idx" ON "PaiementEleve"("eleve_id", "mois", "annee");
CREATE INDEX "PaiementEleve_annee_mois_idx" ON "PaiementEleve"("annee", "mois");

-- AbsenceEleve
CREATE INDEX "AbsenceEleve_etablissement_id_date_idx" ON "AbsenceEleve"("etablissement_id", "date");
CREATE INDEX "AbsenceEleve_eleve_id_date_idx" ON "AbsenceEleve"("eleve_id", "date");

-- Creneau
CREATE INDEX "Creneau_etablissement_id_idx" ON "Creneau"("etablissement_id");
CREATE INDEX "Creneau_professeur_id_annee_scolaire_id_idx" ON "Creneau"("professeur_id", "annee_scolaire_id");
CREATE INDEX "Creneau_classe_id_annee_scolaire_id_idx" ON "Creneau"("classe_id", "annee_scolaire_id");

-- EvenementCalendrier
CREATE INDEX "EvenementCalendrier_etablissement_id_idx" ON "EvenementCalendrier"("etablissement_id");
CREATE INDEX "EvenementCalendrier_etab_dates_idx" ON "EvenementCalendrier"("etablissement_id", "date_debut", "date_fin");

-- Notification
CREATE INDEX "Notification_destinataire_id_lu_created_at_idx" ON "Notification"("destinataire_id", "lu", "created_at");
CREATE INDEX "Notification_etablissement_id_created_at_idx" ON "Notification"("etablissement_id", "created_at");

-- Conversation
CREATE INDEX "Conversation_etablissement_id_updated_at_idx" ON "Conversation"("etablissement_id", "updated_at");

-- PortailParentToken
CREATE INDEX "PortailParentToken_etablissement_id_idx" ON "PortailParentToken"("etablissement_id");

-- Evaluation
CREATE INDEX "Evaluation_etablissement_id_idx" ON "Evaluation"("etablissement_id");
CREATE INDEX "Evaluation_classe_mat_periode_annee_idx" ON "Evaluation"("classe_id", "matiere_id", "periode", "annee_scolaire_id");

-- ProgressionEleve
CREATE INDEX "ProgressionEleve_etablissement_id_idx" ON "ProgressionEleve"("etablissement_id");

-- Activite
CREATE INDEX "Activite_etablissement_id_idx" ON "Activite"("etablissement_id");
CREATE INDEX "Activite_etablissement_id_actif_idx" ON "Activite"("etablissement_id", "actif");

-- DocumentGenere
CREATE INDEX "DocumentGenere_etablissement_id_genere_le_idx" ON "DocumentGenere"("etablissement_id", "genere_le");
