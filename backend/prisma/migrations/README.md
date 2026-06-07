# Migrations Prisma

## Baseline du 2026-06-07

L'historique des 40 migrations initiales (6 mai → 6 juin 2026) a été **consolidé
en une seule migration baseline** : `00000000000000_baseline`.

**Pourquoi ?** L'ancien historique n'était plus rejouable depuis zéro : certaines
migrations avaient été éditées en place (ex. `20260508_rename_caissier_role`
référençait `Role.libelle_ar`, colonne retirée plus tard) et certaines colonnes
du schéma (ex. `ConfigNotes.montant_mensualite`) n'étaient créées par aucune
migration. Conséquence : `prisma migrate deploy` sur une base vierge échouait
(nouvel env, onboarding dev, test d'intégration CI).

**Comment la baseline a été produite :**
1. La prod a d'abord été réconciliée pour correspondre exactement à `schema.prisma`
   (renommage de contraintes/index, suppression de défauts SQL et de la colonne
   orpheline `PersonnelMatiereClasse.coefficient`).
2. `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma`
   a généré le SQL de création complet (50 tables).
3. La baseline a été marquée appliquée sur la prod via
   `prisma migrate resolve --applied 00000000000000_baseline`, puis les anciennes
   lignes de `_prisma_migrations` ont été nettoyées.

L'ancien historique reste consultable dans l'historique git (commit de squash) et
dans les sauvegardes `~/daaragest-backups/` (dump + `baseline_proven_*.sql`).

**Vérifié :** replay de la baseline sur base vierge = OK, et `migrate diff`
baseline ↔ `schema.prisma` = vide (aucune dérive).

## Convention pour les nouvelles migrations

Format strict `YYYYMMDDHHMMSS_libelle_snake_case` avec **heures réelles**, créées
via `npx prisma migrate dev --name <libelle>`. Ne **jamais** éditer une migration
déjà appliquée : ajouter une nouvelle migration à la place.
