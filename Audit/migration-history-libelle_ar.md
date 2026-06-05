# Anomalie — historique des migrations non rejouable depuis zéro

> Découvert le **2026-06-05** en montant les tests d'intégration CI (point #2 de l'audit P1).
> Statut : **à vérifier** — l'utilisateur pense l'avoir déjà corrigé. Voir « Procédure de vérification » plus bas.

## Symptôme

`prisma migrate deploy` (ou `migrate dev`) sur une **base vide** échoue avec :

```
Error: column "libelle_ar" of relation "Role" does not exist
```

L'erreur survient sur la migration `20260508000000_rename_caissier_role`.

## Cause racine

Une migration historique a été **éditée en place** après avoir été appliquée — ce qui viole l'immuabilité des migrations Prisma.

Chronologie (confirmée par `git log`) :

| Date | Commit / migration | Action |
|---|---|---|
| 6 mai | `1d84219` — `20260506053206_init` | `CREATE TABLE "Role"` **avec** colonne `libelle_ar` |
| 8 mai | `20260508000000_rename_caissier_role` | `UPDATE "Role" SET … "libelle_ar" = 'عون التمدرس'` |
| 8 mai | `7888f11` « Remove Arabic fields » | **réécrit le fichier init** pour retirer `libelle_ar` (et `nom_ar`/`prenom_ar`) du `CREATE TABLE`, + ajoute `20260523000000_remove_ar_fields` |

Après cette réécriture, la chaîne se contredit lors d'un replay à neuf :

```
init (édité)        → CREATE TABLE "Role" SANS libelle_ar
20260508_caissier   → UPDATE "Role" SET libelle_ar = '...'   ❌ la colonne n'existe pas
20260523_remove_ar  → drop des autres colonnes _ar (mais PAS Role.libelle_ar)
```

Asymétrie supplémentaire : `20260523_remove_ar_fields` ne drope pas `Role.libelle_ar` (déjà « géré » par l'édition de l'init), donc édition et cleanup ne se correspondent pas exactement.

## Pourquoi la prod n'est pas impactée

La prod n'exécute **jamais** ce SQL. L'`entrypoint.sh` fait un *baseline* : la base avait été créée par `prisma db push` (schéma final direct), puis toutes les migrations marquées « déjà appliquées » sans rejouer leur SQL. Les déploiements suivants ne lancent que les nouvelles migrations. La chaîne cassée est dormante.

## Impact réel

- ❌ Recréer un environnement propre **via les migrations** (nouveau staging, reprise sur base neuve, onboarding dev avec `prisma migrate deploy`).
- ❌ `prisma migrate dev` en local (veut reset).
- ❌ Tests d'intégration CI → contournés par `prisma db push` (cf. `.github/workflows/ci.yml`, job `integration`).
- ✅ Prod actuelle et son cycle de déploiement : aucun impact.
- ⚠️ Signal de fond : l'historique ne reflète plus ce qui a été appliqué → il peut exister d'autres éditions latentes.

## Procédure de vérification (est-ce réglé ?)

Rejouer l'historique complet sur une base jetable :

```bash
cd backend
export PATH="/usr/local/opt/libpq/bin:$PATH"
createdb daaragest_replay_check
DATABASE_URL="postgresql://<user>@localhost:5432/daaragest_replay_check" \
  npx prisma migrate deploy
# ✅ OK  → "All migrations have been successfully applied" : l'historique est réparable/réparé
# ❌ KO  → erreur "column ... does not exist" : encore cassé
dropdb daaragest_replay_check
```

> NB : la CI d'intégration utilise volontairement `prisma db push` (schéma courant), donc **elle ne teste PAS** le replay des migrations — un vert CI ne prouve pas que cette anomalie est résolue. Seule la commande `migrate deploy` ci-dessus le prouve.

## Options de correction

| Option | Principe | Effort / risque |
|---|---|---|
| **A — Guard ciblé** | Rendre l'`UPDATE` de `20260508` tolérant (bloc `DO` ne s'exécutant que si la colonne existe). Débloque le replay, sans effet sur la prod (qui ne rejoue pas ce SQL). | Faible — vérifier qu'aucune autre migration intermédiaire ne référence `nom_ar`/`prenom_ar`. |
| **B — Squash / re-baseline** | Consolider l'historique en **une** migration baseline = `schema.prisma` actuel, re-baseliner la prod. Historique propre et rejouable. | Plus lourd, mais assainit durablement. |

Recommandation : **B** à terme (prod déjà baselinée + besoin d'une CI fiable), **A** comme déblocage immédiat.
