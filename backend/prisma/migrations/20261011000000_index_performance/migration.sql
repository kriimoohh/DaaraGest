-- Index manquants relevés par l'audit SenInit (parcours complets dès que les données grossissent ou
-- qu'un 2ᵉ établissement arrive) : inscriptions par élève / par année, notes par année-période-matière,
-- pointages par date, affectations des professeurs, bulletins par année-période, absences par classe.
-- IF NOT EXISTS : sans effet là où l'index existe déjà.
CREATE INDEX IF NOT EXISTS "AbsenceEleve_classe_id_date_idx" ON "AbsenceEleve"("classe_id", "date");
CREATE INDEX IF NOT EXISTS "Bulletin_annee_scolaire_id_periode_filiere_idx" ON "Bulletin"("annee_scolaire_id", "periode", "filiere");
CREATE INDEX IF NOT EXISTS "Inscription_eleve_id_idx" ON "Inscription"("eleve_id");
CREATE INDEX IF NOT EXISTS "Inscription_annee_scolaire_id_statut_idx" ON "Inscription"("annee_scolaire_id", "statut");
CREATE INDEX IF NOT EXISTS "Note_annee_scolaire_id_periode_matiere_id_idx" ON "Note"("annee_scolaire_id", "periode", "matiere_id");
CREATE INDEX IF NOT EXISTS "PersonnelMatiereClasse_personnel_id_idx" ON "PersonnelMatiereClasse"("personnel_id");
CREATE INDEX IF NOT EXISTS "PersonnelMatiereClasse_classe_id_idx" ON "PersonnelMatiereClasse"("classe_id");
CREATE INDEX IF NOT EXISTS "PresencePersonnel_date_idx" ON "PresencePersonnel"("date");
