# Audit DaaraGest — Mai 2026 (révision)

Audit complet du projet sur 4 axes, **réalisé le 2026-05-22** (révision du précédent audit du 2026-05-19 après application des sprints correctifs).

## Sommaire

| # | Axe | Note | Δ | Fichier |
|---|---|---|---|---|
| 01 | **Pédagogique** — modèle métier, modules, workflows scolaires | 8.5/10 | +0.5 | [01-audit-pedagogique.md](./01-audit-pedagogique.md) |
| 02 | **Cybersécurité** — auth, JWT, RBAC, validation, secrets | 8/10 | +2 | [02-audit-cybersecurite.md](./02-audit-cybersecurite.md) |
| 03 | **Ingénierie & conception** — archi, code, tests, scalabilité | 7.5/10 | +0.5 | [03-audit-ingenierie-conception.md](./03-audit-ingenierie-conception.md) |
| 04 | **Visuel & design** — palette, typo, UI, a11y, RTL | 8.5/10 | +1 | [04-audit-visuel-design.md](./04-audit-visuel-design.md) |

## Méthode

- Lecture exhaustive du code source à HEAD `7774258` (branche `main`, 33 modules backend, 24 pages frontend, schéma Prisma 50+ modèles).
- Exécution de la suite de tests Vitest (**461 ✅ verts en 1.42s**).
- Revue diff vs audit précédent (`b6890f1` → `HEAD`) — 30+ commits, 5 sprints correctifs (Sprint 0 P0, Sprint 1.1 sécu backend, Sprint 1.2 token mémoire, Sprint 2 infra DX, Sprint 3 design a11y, Sprint 4 pédago débloquants).
- Inspection des nouveaux modules : `personnel` (refactor `professeur → personnel`), `demandes-absence-personnel`, `evaluations`, `fonctions`, `rapports`, `progression`.
- Inspection cross-audit : memory file + README + migrations Prisma (29 désormais).

## Cross-audit — Acquis majeurs depuis 2026-05-19

| # | Origine | Acquis | Vérifié |
|---|---|---|---|
| 1 | 🔐 Sécu C1 | Fail-fast `QR_SECRET` via Zod | [env.ts:7](../backend/src/config/env.ts#L7) |
| 2 | 🔐 Sécu C2 | `escapeHtml` dans `documents.replaceVars` | [documents.service.ts:401](../backend/src/modules/documents/documents.service.ts#L401) |
| 3 | 🔐 Sécu C3 | Token JWT plus en localStorage, httpOnly cookie only | [authStore.ts:28](../frontend/src/store/authStore.ts#L28) |
| 4 | 🔐 Sécu C4 | `COOKIE_DOMAIN` sans défaut hardcodé | [env.ts:9](../backend/src/config/env.ts#L9) |
| 5 | 🔐 Sécu H1 | Autorisation horizontale via `teachingPolicy.ts` | [teachingPolicy.ts:34](../backend/src/utils/teachingPolicy.ts#L34) |
| 6 | 🔐 Sécu H2 | Portail parent : expiration `date_fin` + rate-limit 30/min | [portail-parent.routes.ts:14](../backend/src/modules/portail-parent/portail-parent.routes.ts#L14) |
| 7 | 🔐 Sécu H4 | Logger Fastify redaction complète | [server.ts:48](../backend/src/server.ts#L48) |
| 8 | 🔐 Sécu H5 | `setErrorHandler` gère Prisma errors | [server.ts:148](../backend/src/server.ts#L148) |
| 9 | 🔐 Sécu M2 | Complexité mot de passe (regex MAJ/min/chiffre/spec) | [passwordPolicy.ts:8](../backend/src/utils/passwordPolicy.ts#L8) |
| 10 | ⚙️ Ingé E2 | 41 indexes Prisma (vs 7) | `schema.prisma` |
| 11 | ⚙️ Ingé E4 | CI GitHub Actions (backend + frontend) | [ci.yml](../.github/workflows/ci.yml) |
| 12 | ⚙️ Ingé E10 | `dist/` plus traqué par git | `git ls-files` vide |
| 13 | ⚙️ Ingé E11 | `config/env.ts` Zod centralisé | [env.ts](../backend/src/config/env.ts) |
| 14 | 🎨 Design V1 | 4 tokens fantômes aliasés | [index.css:76-80](../frontend/src/index.css#L76) |
| 15 | 🎨 Design V2 | `@keyframes pulse` + `spin` globaux | [index.css:670-671](../frontend/src/index.css#L670) |
| 16 | 🎨 Design V3 | Scanner repeint aux tokens daara | [Scanner.tsx](../frontend/src/pages/Pointage/Scanner.tsx) |
| 17 | 🎨 Design V13 | `--ink-3 #6A604F` WCAG AA | [index.css:18](../frontend/src/index.css#L18) |
| 18 | 🎨 Design V15 | `prefers-reduced-motion` respecté | [index.css:675](../frontend/src/index.css#L675) |
| 19 | 📚 Pédago P1 | Validation Zod note sans `.max(20)` | [notes.schema.ts:11](../backend/src/modules/notes/notes.schema.ts#L11) |
| 20 | 📚 Pédago P2 | Bulletins annuels `nb_periodes` dynamique | [bulletins.service.ts:137](../backend/src/modules/bulletins/bulletins.service.ts#L137) |

## Cross-audit — Priorisation P1 à traiter

| # | Origine | Action | Effort |
|---|---|---|---|
| 1 | 🔐 Sécu H1 | **Soft-delete pour `bulkSupprimerEleves`** (RGPD) | 2 h |
| 2 | 🔐 Sécu H3 | **Content-Security-Policy** (mode Report-Only) | 1 h + 48 h obs |
| 3 | 🔐 Sécu H4 | **`.uuid()` partout dans Zod** (validation stricte) | 2 h |
| 4 | ⚙️ Ingé E3 | **ESLint + Prettier + intégration CI** | 1 h |
| 5 | ⚙️ Ingé E4 | **Sentry backend + frontend** (observabilité) | 0.5 j |
| 6 | ⚙️ Ingé E2 | **Cache LRU sur lectures read-mostly** (-40% req DB) | 2 h |
| 7 | ⚙️ Ingé E12 | **Code-splitting Vite + React.lazy** (TTI -40%) | 1 h |
| 8 | ⚙️ Ingé E15 | **`process.env` → `env` importé** (2 fichiers) | 5 min |
| 9 | 🎨 Design V6 | **`aria-label` Topbar + `role` Tabs** | 0.5 j |
| 10 | 🎨 Design V5 | **`#fff` hardcodés → `var(--card)`** | 1 h |
| 11 | 📚 Pédago P1 | **i18n des appréciations bulletin** | 1 j |
| 12 | 📚 Pédago P8 | **Rapport charges hebdo par personnel** | 2 h |
| 13 | 📚 Pédago P9 | **Téléchargement bulletin PDF via portail parent** | 1 h |

**Total P1 cross-audit : ~3 j** pour pousser la posture globale au niveau **enterprise** (9/10 cumulé).

## Évolutions notables vs audit précédent

### Renforts (sprints appliqués)
- **Sprint 0 (P0)** — quick wins sécurité + design ouvert
- **Sprint 1.1** — durcissement sécurité backend (H1/H2/H4/H5/M2)
- **Sprint 1.2** — token JWT en mémoire + audit log (C3 + M5/M6)
- **Sprint 2** — infra & DX (E2 indexes / E4 CI / E10 dist / E11 env)
- **Sprint 3** — design polish + a11y (V6/V8/V13/V14/V15)
- **Sprint 4** — pédagogique débloquants (P1 notes.max + P2 nb_periodes)

### Nouveautés fonctionnelles
- **Module Personnel unifié** (anciennement Professeur) — table `Personnel`, refactor RBAC, `PersonnelMatiereClasse`, contrats CDD/CDI
- **Module Demandes d'Absence Personnel** — workflow congés/maladies/permissions avec validation direction
- **Module Évaluations formatives** — DS/INTERRO/DM/EXAMEN avec coefficient propre
- **Module Fonctions configurables** — chaque établissement définit ses fonctions (Directeur, Surveillant, etc.)
- **Module Rapports académiques** — 9 rapports dont grilles IEF officielles sénégalaises (CI/CP, CE1/CE2, CM1/CM2) + propositions fin d'année multilingues
- **Civilité directeur** — accords en genre automatiques dans les documents
- **Sexe utilisateur + Contrats stagiaire** — durcissement RH

### Dette qui s'aggrave
- **Frontend monolithique** : `Eleves/index.tsx` 1600 → 1635 lignes, `Parametres/index.tsx` 1128 → 1310. **Aucun découpage** n'a été initié.
- **Inline styles** : Eleves 124 → 125, Parametres 101 → 110. La règle "extraction progressive" n'a pas été appliquée.

## Comment utiliser ces documents

1. **Lecture séquentielle** : ouvrir le README → choisir un axe → traiter par ordre de priorité (🔴 P0 d'abord, 🟠 P1 ensuite).
2. **Format actionnable** : chaque constat indique un fichier `path:line` cliquable + un fix proposé + un effort estimé.
3. **Ouverture d'issues** : copier-coller le constat (titre + bloc Markdown) directement dans un ticket GitHub/Linear.
4. **Suivi** : cocher les actions au fur et à mesure (✅ / 🟡 en cours / ❌ abandonné).

## Décisions à arbitrer (hors P1)

- **Tailwind in/out** (Design V7) — coût de migration vs maintien de la config inutilisée.
- **App mobile React Native** (roadmap README) — impacte les choix de refresh token (Sécu H2) et de cache.
- **Multi-tenant ouvert vs single-tenant fermé** — impacte les priorités Sécu (CSRF, brute-force progressif).
- **Évaluation par compétences** (Pédago P3) — refonte modèle Notes potentielle.
- **Découpage frontend** (Ingé E1) — sprint dédié vs refactor opportuniste.

---

*Auditeur : Claude (Opus 4.7) — révision technique du 2026-05-22, comparée à l'audit initial du 2026-05-19.*
