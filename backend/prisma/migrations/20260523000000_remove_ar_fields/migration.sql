-- Migration : suppression des champs AR (sauf Matiere.nom_ar qui devient nullable).
-- Cf. décision produit du 2026-05-23 : seul le bilinguisme des matières est conservé.

-- 1. Nettoyage de la donnée JSON ConfigNotes.noms_periodes (suppression de la clé "ar").
UPDATE "ConfigNotes"
SET "noms_periodes" = "noms_periodes" - 'ar'
WHERE jsonb_typeof("noms_periodes") = 'object' AND "noms_periodes" ? 'ar';

-- 2. Mise à jour de la valeur par défaut Prisma pour noms_periodes (plus de clé "ar").
ALTER TABLE "ConfigNotes"
  ALTER COLUMN "noms_periodes" SET DEFAULT '{"fr":["1er Trimestre","2ème Trimestre","3ème Trimestre"]}';

-- 3. Matiere.nom_ar : devient nullable, retrait du défaut "" legacy.
ALTER TABLE "Matiere"
  ALTER COLUMN "nom_ar" DROP NOT NULL,
  ALTER COLUMN "nom_ar" DROP DEFAULT;

-- 4. DROP des colonnes AR sur les modèles concernés.
ALTER TABLE "Utilisateur"          DROP COLUMN IF EXISTS "nom_ar";
ALTER TABLE "Personnel"            DROP COLUMN IF EXISTS "specialite_ar";
ALTER TABLE "Fonction"             DROP COLUMN IF EXISTS "libelle_ar";
ALTER TABLE "Domaine"              DROP COLUMN IF EXISTS "nom_ar";
ALTER TABLE "Parent"               DROP COLUMN IF EXISTS "nom_ar";
ALTER TABLE "Bulletin"             DROP COLUMN IF EXISTS "observation_ar";
ALTER TABLE "EvenementCalendrier"  DROP COLUMN IF EXISTS "titre_ar";
ALTER TABLE "Activite"             DROP COLUMN IF EXISTS "nom_ar";
