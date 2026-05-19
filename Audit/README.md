# Audit DaaraGest — Mai 2026

Audit complet du projet sur 4 axes, mené le **2026-05-19**.

## Sommaire

| # | Axe | Note | Fichier |
|---|---|---|---|
| 01 | **Pédagogique** — modèle métier, modules, workflows scolaires | 8/10 | [01-audit-pedagogique.md](./01-audit-pedagogique.md) |
| 02 | **Cybersécurité** — auth, JWT, RBAC, validation, secrets | 6/10 | [02-audit-cybersecurite.md](./02-audit-cybersecurite.md) |
| 03 | **Ingénierie & conception** — archi, code, tests, scalabilité | 7/10 | [03-audit-ingenierie-conception.md](./03-audit-ingenierie-conception.md) |
| 04 | **Visuel & design** — palette, typo, UI, a11y, RTL | 7.5/10 | [04-audit-visuel-design.md](./04-audit-visuel-design.md) |

## Méthode

- Lecture exhaustive du code source (backend 124 fichiers TS, frontend 56 fichiers TSX, schéma Prisma 44 modèles).
- Exécution de la suite de tests Vitest (428 ✅ verts, 2.7 s).
- Inspection croisée memory file projet + README + migrations Prisma.
- Audit basé sur les fichiers à l'état HEAD `b6890f1` (branche `main`).

## Priorisation globale

Chaque audit liste ses propres actions priorisées (P0 → P3). Voici la **synthèse cross-audit** des P0 à traiter en premier :

| # | Origine | Action | Effort |
|---|---|---|---|
| 1 | 🔐 Sécu C1 | Fail-fast sur `QR_SECRET` manquant | 5 min |
| 2 | 🔐 Sécu C2 | `escapeHtml` dans `documents.replaceVars` | 30 min |
| 3 | 🔐 Sécu C4 | Retirer le défaut `.dg.sakai.sn` de `COOKIE_DOMAIN` | 5 min |
| 4 | 🎨 Design V1 | Aliaser les 4 tokens CSS fantômes (`--surface-2`, `--border`, `--radius`, `--text-muted`) | 15 min |
| 5 | 🎨 Design V2 | Ajouter `@keyframes pulse` | 2 min |
| 6 | 🎨 Design V3 | Repeindre `Pointage/Scanner.tsx` aux tokens daara | 1 h |

**Total P0 cross-audit : ~2 h** pour fermer les écarts les plus critiques avant déploiement multi-établissement.

## Comment utiliser ces documents

1. **Lecture séquentielle** : ouvrir le README → choisir un axe → traiter par ordre de priorité (🔴 P0 d'abord).
2. **Format actionnable** : chaque constat indique un fichier `path:line` cliquable + un fix proposé + un effort estimé.
3. **Ouverture d'issues** : copier-coller le constat (titre + bloc Markdown) directement dans un ticket GitHub/Linear.
4. **Suivi** : cocher les actions au fur et à mesure (✅ / 🟡 en cours / ❌ abandonné).

## Décisions à arbitrer (hors P0)

- **Tailwind in/out** (Design V4) — coût de migration vs maintien de la config inutilisée.
- **App mobile React Native** (roadmap README) — impacte les choix de refresh token (Sécu H3) et de cache.
- **Multi-tenant ouvert vs single-tenant fermé** — impacte les priorités Sécu (H1 horizontal, M3 hard-delete).
- **Évaluation par compétences** (Pédago P4) — refonte modèle Notes potentielle.

---

*Auditeur : Claude (Opus 4.7) — session de revue technique du 2026-05-19.*
