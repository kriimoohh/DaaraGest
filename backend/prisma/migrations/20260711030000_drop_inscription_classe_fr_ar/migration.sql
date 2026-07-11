-- Phase 2d : retrait des colonnes Inscription.classe_fr_id / classe_ar_id, devenues
-- redondantes avec la jointure InscriptionClasse (source de vérité depuis 2b/2c).
-- Non destructif pour les données : tout est déjà dans InscriptionClasse (backfill
-- 2a + double-écriture, cohérence auditée = 0 divergence). DROP COLUMN retire aussi
-- automatiquement les contraintes FK associées.

ALTER TABLE "Inscription" DROP COLUMN "classe_fr_id";
ALTER TABLE "Inscription" DROP COLUMN "classe_ar_id";
