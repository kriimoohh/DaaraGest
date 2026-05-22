# Audit DaaraGest — Mai 2026 (révision + Sprints 5 & 6)

Audit complet du projet sur 4 axes, **réalisé le 2026-05-22** (révision du précédent audit du 2026-05-19) — suivi du **Sprint 5** qui applique l'ensemble des P1 cross-audit identifiés.

## Sommaire

| # | Axe | Note initiale | Note post-révision | Note post-Sprint 5 | Fichier |
|---|---|---|---|---|---|
| 01 | **Pédagogique** — modèle métier, modules, workflows scolaires | 8/10 | 8.5/10 | **9/10** | [01-audit-pedagogique.md](./01-audit-pedagogique.md) |
| 02 | **Cybersécurité** — auth, JWT, RBAC, validation, secrets | 6/10 | 8/10 | **9/10** | [02-audit-cybersecurite.md](./02-audit-cybersecurite.md) |
| 03 | **Ingénierie & conception** — archi, code, tests, scalabilité | 7/10 | 7.5/10 | **8.5/10** | [03-audit-ingenierie-conception.md](./03-audit-ingenierie-conception.md) |
| 04 | **Visuel & design** — palette, typo, UI, a11y, RTL | 7.5/10 | 8.5/10 | **9/10** | [04-audit-visuel-design.md](./04-audit-visuel-design.md) |

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

## Cross-audit — Sprint 5 appliqué (2026-05-22)

Tous les **P1 cross-audit** identifiés ont été corrigés en un seul sprint :

| # | Origine | Action | Statut | Référence |
|---|---|---|---|---|
| 1 | 🔐 Sécu H1 | Soft-delete pour `bulkSupprimerEleves` | ✅ | [eleves.service.ts:308-326](../backend/src/modules/eleves/eleves.service.ts#L308) — `updateMany({ actif: false })`, conserve historique |
| 2 | 🔐 Sécu H3 | Content-Security-Policy | ✅ | [server.ts:90-99](../backend/src/server.ts#L90) — CSP en mode `Report-Only` en dev, strict en prod |
| 3 | 🔐 Sécu H4 | `.uuid()` partout dans Zod | ✅ | 37 champs `_id` convertis via sed sur tous les `*.schema.ts` |
| 4 | ⚙️ Ingé E3 | ESLint + Prettier + intégration CI | ✅ | [.eslintrc.cjs](../backend/.eslintrc.cjs) + [.prettierrc](../backend/.prettierrc) + [ci.yml](../.github/workflows/ci.yml#L37) |
| 5 | ⚙️ Ingé E2 | Cache LRU sur lectures read-mostly | ✅ | [utils/cache.ts](../backend/src/utils/cache.ts) — `LruCache` + intégration dans `parametres.service.ts` avec invalidation |
| 6 | ⚙️ Ingé E12 | Code-splitting Vite + React.lazy | ✅ | [App.tsx](../frontend/src/App.tsx) — 25 pages en `lazy()` + [vite.config.ts](../frontend/vite.config.ts) `manualChunks` |
| 7 | ⚙️ Ingé E15 | `process.env` → `env` importé | ✅ | [eleves.service.ts:6-8](../backend/src/modules/eleves/eleves.service.ts#L6) + [documents.service.ts:6-8](../backend/src/modules/documents/documents.service.ts#L6) |
| 8 | 🎨 Design V6 | `aria-label` + `role="tablist"`/`tab`/`tabpanel` | ✅ | [Header.tsx](../frontend/src/components/layout/Header.tsx) — tabs profil ARIA complets |
| 9 | 🎨 Design V5 | `#fff` hardcodés → `var(--card)` | ✅ | sed sur `pages/**/*.tsx` — 46 occurrences corrigées |
| 10 | 🎨 Design V4 | EmploiDuTemps repeint aux tokens daara | ✅ | [EmploiDuTemps/index.tsx:41-45](../frontend/src/pages/EmploiDuTemps/index.tsx#L41) — `--indigo-soft` (FR), `--sahel-soft` (AR) |
| 11 | 🎨 Design V2+V3 | `--space-*` et `--text-*` centralisés | ✅ | [index.css:55-79](../frontend/src/index.css#L55) — 8 valeurs spacing + 8 tailles typo |
| 12 | 📚 Pédago P1 | i18n des appréciations bulletin (FR/AR/COMBINE) | ✅ | [bulletins.service.ts:7-37](../backend/src/modules/bulletins/bulletins.service.ts#L7) — table `APPRECIATIONS` + `COMBINE` bi-langue |
| 13 | 📚 Pédago P2 | Blocage saisie absence pendant vacances | ✅ | [utils/calendrier.ts](../backend/src/utils/calendrier.ts) + [absences.service.ts:87,127](../backend/src/modules/absences/absences.service.ts) |
| 14 | 📚 Pédago P8 | Rapport charges hebdo par personnel | ✅ | [rapports.service.ts:`rapportChargesPersonnel`](../backend/src/modules/rapports/rapports.service.ts) + route `/api/v1/rapports/charges-personnel` |
| 15 | 📚 Pédago P9 | Téléchargement bulletin PDF via portail parent | ✅ | [portail-parent.service.ts:`getBulletinPdfViaToken`](../backend/src/modules/portail-parent/portail-parent.service.ts) + route `/portail-parent/acces/:token/bulletin/:bulletin_id/pdf` (rate-limit 10/min) |

**Résultats Sprint 5 :**
- ✅ 461 tests backend verts (1.5s)
- ✅ Type-check backend + frontend OK
- ✅ Build frontend OK avec code-splitting actif (40+ chunks)
- ✅ ESLint/Prettier configurés (mode non bloquant en CI le temps de stabiliser)

**Skip volontaires** (jugés trop risqués ou trop gros pour ce sprint) :
- **Sécu H2** — Refresh token rotation par device : risque de casser la session courante, à coordonner avec l'app mobile
- **Ingé E4** — Sentry : nécessite un DSN + variables d'env supplémentaires, à faire au déploiement
- **Ingé E1** — Découpage `Eleves/index.tsx` (1635 lignes) : sprint dédié recommandé
- **Ingé E5** — Tests frontend : setup Vitest + RTL + 5-10 tests = 1 j hors scope P1
- **Ingé E6** — TanStack Query : 2 j de migration progressive
- **Ingé E14** — Remplacer `$executeRawUnsafe` séquences : migration Prisma + service à coordonner

## Sprint 6 — Cohérence (2026-05-22)

Après analyse de cohérence du codebase, **toutes** les incohérences structurelles trouvées ont été corrigées :

| # | Thème | Action | Référence |
|---|---|---|---|
| 1 | 🔄 Refactor Personnel Phase 2 | `paiementProfesseur*` → `paiementPersonnel*` (schema, service, controller, routes) avec routes alias `/paiements-professeurs` pour rétro-compat | [finances.routes.ts](../backend/src/modules/finances/finances.routes.ts) |
| 2 | 🔄 Refactor Personnel Phase 2 | `pointage` param `professeurId` → `personnelId` avec routes alias `/qr/legacy/:professeurId` | [pointage.routes.ts](../backend/src/modules/pointage/pointage.routes.ts) |
| 3 | 🔄 Refactor Personnel Phase 2 | `rapportPresencesProfesseurs` → `rapportPresencesPersonnel` (handler, schema, route, libellés affichés) | [rapports.service.ts](../backend/src/modules/rapports/rapports.service.ts) |
| 4 | 🔄 Refactor Personnel Phase 2 | `presence_professeurs` → `presence_personnel` dans la réponse Dashboard (+ alias compat) | [stats.service.ts](../backend/src/modules/stats/stats.service.ts) |
| 5 | 🔄 Refactor Personnel Phase 2 | Frontend Dashboard/Personnel/Finances/Rapports mis à jour sur les nouveaux noms | divers |
| 6 | 🔄 Refactor Personnel Phase 2 | Tests RBAC + métier nettoyés (routes mortes `/professeurs` retirées) | [rbac.test.ts](../backend/src/modules/rbac/rbac.test.ts) |
| 7 | 🎯 Bulletins périodes dynamiques | `[1, 2, 3]` hardcodé dans `getBulletin` et `toAnnuelRows` → `nbPeriodes` depuis ConfigNotes | [bulletins.service.ts](../backend/src/modules/bulletins/bulletins.service.ts) |
| 8 | 🧹 Code dupliqué | `getQrSecret()` factorisé dans `utils/qrSecret.ts` | [utils/qrSecret.ts](../backend/src/utils/qrSecret.ts) |
| 9 | 🧹 Code dupliqué | `escapeHtml()` factorisé dans `utils/escapeHtml.ts` | [utils/escapeHtml.ts](../backend/src/utils/escapeHtml.ts) |
| 10 | 🧭 Nav unifiée | `frontend/src/config/routes.ts` (source unique) + CommandPalette et Header.tsx consomment | [config/routes.ts](../frontend/src/config/routes.ts) |
| 11 | 🧭 Nav unifiée | Header.tsx `PAGE_TITLES` figé en français → titre via i18n (`nav.<key>`) | [Header.tsx](../frontend/src/components/layout/Header.tsx) |
| 12 | 🎨 Couleurs hors palette | 5 `#3B82F6` (NotificationBell, Calendrier, PortailParent, Finances) → tokens daara (`var(--info)`, `var(--indigo)`, `var(--terra)`) | divers |
| 13 | 📚 Schema bilingues | Politique `nom_ar` documentée dans le header de `schema.prisma` (cible : nullable, legacy obligatoire conservé) | [schema.prisma](../backend/prisma/schema.prisma) |
| 14 | 📚 Migrations corrompues | Dette documentée dans `prisma/migrations/README.md` (ne pas renommer en place, recette pour env vierge) | [prisma/migrations/README.md](../backend/prisma/migrations/README.md) |

**Résultats Sprint 6 :**
- ✅ 461 tests backend toujours verts (1.5s)
- ✅ Type-check backend + frontend OK
- ✅ Build frontend OK
- ✅ Toute la nav est cohérente (Sidebar + CommandPalette + Header)
- ✅ Aucune route morte `/professeurs` côté frontend
- ✅ Backward-compat des anciennes URLs API via routes alias (transition douce)

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
