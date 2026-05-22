# Migrations Prisma — Notes de dette technique

## Timestamps non standards

Trois migrations historiques portent des timestamps qui ne sont pas des heures
réelles (Prisma trie les dossiers en string sort, donc l'ordre est respecté,
mais c'est cosmétiquement bizarre) :

| Dossier | Heure prétendue | Constat |
|---|---|---|
| `20260519300000_qr_pointage` | `30:00:00` | 30h n'existe pas |
| `20260519400000_carte_id_qr_token` | `40:00:00` | 40h n'existe pas |
| `20260522000000_civilite_directeur` | `00:00:00` | collision avec ↓ |
| `20260522000000_domaines_grilles` | `00:00:00` | même seconde que ↑ |

**Pas d'impact fonctionnel** : Prisma applique dans l'ordre alphanumérique du
nom complet (`civilite_directeur` < `domaines_grilles`), donc le tri est
stable. Et `qr_pointage` < `carte_id_qr_token` < `add_perf_indexes` sur le tri
lexical, ce qui correspond à l'ordre métier voulu.

**Pourquoi ne pas renommer ?** Renommer un dossier de migration **déjà
appliquée** désynchronise la table `_prisma_migrations` côté environnement et
force un `prisma migrate resolve --applied <new_name>` manuel. Les coûts
opérationnels (envs dev d'équipe, staging) dépassent le bénéfice cosmétique.

**Si vous voulez quand même nettoyer** (avant tout déploiement sur un nouvel
env vierge) :

```sh
# Sur une base fraîche uniquement — destructive sinon
mv prisma/migrations/20260519300000_qr_pointage         prisma/migrations/20260519030000_qr_pointage
mv prisma/migrations/20260519400000_carte_id_qr_token   prisma/migrations/20260519040000_carte_id_qr_token
mv prisma/migrations/20260522000000_domaines_grilles    prisma/migrations/20260522010000_domaines_grilles
npx prisma migrate reset
```

## Convention pour les nouvelles migrations

Format strict `YYYYMMDDHHMMSS_libelle_snake_case` avec **heures réelles** :

```sh
# Bon
20260601090000_add_competences

# Mauvais
20260601900000_add_competences   # 90h invalide
20260601090000_add_xxx           # collision possible si même seconde
```

`npx prisma migrate dev --name ...` génère automatiquement un timestamp valide
basé sur l'heure courante — ne pas modifier.
