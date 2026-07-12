-- Consolidation des mentions : la table Mention devient l'unique source des
-- seuils d'appréciation (ConfigNotes.seuil_* supprimés).
--
-- 1) Backfill : pour chaque établissement sans mention de portée établissement
--    (filiere_id IS NULL AND niveau_id IS NULL), on sème les 5 mentions par
--    défaut depuis ses anciens seuils — même logique que le semis paresseux de
--    mentions.service : seuils bruts s'ils sont cohérents avec note_max
--    (seuil_tres_bien < note_max), sinon pourcentages 80/70/60/50 de note_max
--    arrondis au 0.5.
-- 2) Drop des 4 colonnes.

INSERT INTO "Mention" ("id", "etablissement_id", "filiere_id", "niveau_id", "libelle_fr", "libelle_ar", "seuil_min", "couleur", "ordre", "is_system")
SELECT
  gen_random_uuid()::text,
  cn."etablissement_id",
  NULL,
  NULL,
  v.libelle,
  NULL,
  CASE WHEN cn."seuil_tres_bien" < cn."note_max"
       THEN v.seuil_config
       ELSE round(cn."note_max" * v.pct * 2) / 2
  END,
  v.couleur,
  v.ordre,
  v.is_system
FROM "ConfigNotes" cn
CROSS JOIN LATERAL (
  VALUES
    ('Très bien',   cn."seuil_tres_bien",  0.80::numeric, 'success', 1,  false),
    ('Bien',        cn."seuil_bien",       0.70::numeric, 'info',    2,  false),
    ('Assez bien',  cn."seuil_assez_bien", 0.60::numeric, 'info',    3,  false),
    ('Passable',    cn."seuil_passable",   0.50::numeric, 'warning', 4,  false),
    ('Insuffisant', 0::numeric,            0::numeric,    'error',   99, true)
) AS v(libelle, seuil_config, pct, couleur, ordre, is_system)
WHERE NOT EXISTS (
  SELECT 1 FROM "Mention" m
  WHERE m."etablissement_id" = cn."etablissement_id"
    AND m."filiere_id" IS NULL
    AND m."niveau_id" IS NULL
);

-- AlterTable
ALTER TABLE "ConfigNotes" DROP COLUMN "seuil_assez_bien",
DROP COLUMN "seuil_bien",
DROP COLUMN "seuil_passable",
DROP COLUMN "seuil_tres_bien";
