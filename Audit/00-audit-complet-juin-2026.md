# Audit complet DaaraGest — Juin 2026

> Audit transversal sur 4 axes : **pédagogie**, **cybersécurité**, **ingénierie conceptuelle**, **design**.
>
> **Date** : 7 juin 2026 · **HEAD** : `f94ead5` · **Méthode** : lecture du code source, exécution de la suite de tests Vitest, vérification croisée avec le dossier `Audit/` (mai 2026).

---

## Sommaire

- [Synthèse exécutive](#synthèse-exécutive)
- [1. Pédagogie](#1-pédagogie--910)
- [2. Cybersécurité](#2-cybersécurité--8510)
- [3. Ingénierie conceptuelle](#3-ingénierie-conceptuelle--810)
- [4. Design](#4-design--8510)
- [Cartographie fonctionnelle](#cartographie-fonctionnelle)
- [Priorisation transversale](#priorisation-transversale)
- [Conclusion](#conclusion)

---

## Synthèse exécutive

**DaaraGest** est une application web de gestion scolaire franco-arabe pour le Sénégal : élèves, notes, bulletins, finances, RH, portail parents, interface bilingue FR/AR avec RTL natif.

| Axe | Note | Tendance |
|-----|------|----------|
| **Pédagogie** | **9/10** | Stable — couverture métier très large |
| **Cybersécurité** | **8,5/10** | Forte maturité backend, lacunes défensives résiduelles |
| **Ingénierie conceptuelle** | **8/10** | Backend solide, dette frontend qui s'aggrave |
| **Design** | **8,5/10** | Identité forte, dette de mise en forme (inline styles) |

### Métriques clés (HEAD)

| Indicateur | Valeur |
|------------|--------|
| Tests backend Vitest | **484** verts (~2,7 s) |
| Modèles Prisma | **50** |
| Modules backend | **~36** |
| Pages frontend | **32** |
| Clés i18n FR / AR | **~1 750** / **~1 559** |
| `Eleves/index.tsx` | **1 637** lignes |
| `Parametres/index.tsx` | **1 874** lignes |

**Verdict global** : produit **production-ready** pour une école franco-arabe primaire/collège (10–50 établissements). Les fondations métier et sécurité sont au-dessus de la moyenne pour un ERP scolaire. Le principal risque long terme est la **maintenabilité frontend**, pas la couverture fonctionnelle.

---

## 1. Pédagogie — 9/10

### Ce que le produit fait bien

DaaraGest couvre un **cycle scolaire complet** adapté au contexte sénégalais franco-arabe :

- **Double filière native** : inscription simultanée classe FR + classe AR, bulletins `FR` / `AR` / `COMBINE` / `ANNUEL`
- **Barème flexible** : coefficients par classe (`ClasseMatiere.coeff_override`), `note_max` configurable, périodes dynamiques (`ConfigNotes.nb_periodes`)
- **Évaluations formatives** : DS, interro, DM, examen avec pondération propre
- **Ancrage IEF** : domaines pédagogiques (`LANGUE_COMMUNICATION`, `MATHEMATIQUES`, `ESVS`…), grilles par niveau (`CI_CP`, `CE1_CE2`, `CM1_CM2`), rapports officiels dans `/rapports`
- **Progression pluriannuelle** : décision auto (`admis` / `redoublant`) vs `seuil_passage`, validation manuelle direction
- **Vie scolaire** : absences avec alertes, activités parascolaires (5 modèles), emploi du temps avec jours actifs configurables
- **RH pédagogique** : refactor `Personnel` unifié (prof, surveillant, etc.), fonctions configurables par établissement, demandes d'absence personnel
- **Portail parents** : accès sans compte (token UUID), notes, paiements, absences, téléchargement bulletin PDF

### Modules pédagogiques majeurs

| Module | Fichier / référence | Description |
|--------|---------------------|-------------|
| Notes | `backend/src/modules/notes/` | Saisie en masse, validation par matière, plafond dynamique |
| Bulletins | `backend/src/modules/bulletins/` | 4 types, PDF Puppeteer, mentions configurables |
| Évaluations | `backend/src/modules/evaluations/` | Formatives avec coefficient propre |
| Progression | `backend/src/modules/progression/` | Décision auto + validation direction |
| Rapports IEF | `backend/src/modules/rapports/` | 9 rapports dont grilles officielles sénégalaises |
| Activités | `backend/src/modules/activites/` | Parascolaire complet (séances, présences, évaluations) |
| Portail parent | `backend/src/modules/portail-parent/` | Token UUID, PDF bulletin, rate-limit |

### Corrections validées depuis l'audit de mai 2026

| Sujet | État | Référence |
|-------|------|-----------|
| Plafond note Zod à 20 | ✅ Corrigé | `backend/src/modules/notes/notes.schema.ts` — plafond délégué à la matière |
| Bulletins annuels sur 3 trimestres figés | ✅ Corrigé | `backend/src/modules/bulletins/bulletins.service.ts` — `nb_periodes` dynamique |
| Appréciations bulletins en français uniquement | ✅ Corrigé | `LIBELLES` FR/AR + table `Mention` paramétrable (`schema.prisma`) |
| Blocage saisie pendant vacances | ✅ Corrigé | `backend/src/utils/calendrier.ts` — `assertDateNonVacances()` |
| Rapport charges horaires personnel | ✅ Corrigé | `GET /api/v1/rapports/charges-personnel` |
| PDF bulletin via portail parent | ✅ Corrigé | `getBulletinPdfViaToken()` dans `portail-parent.service.ts` |

### Lacunes pédagogiques restantes

| Priorité | Lacune | Impact | Effort estimé |
|----------|--------|--------|---------------|
| 🟡 P2 | **Évaluation par compétences** — `type_note: COMPETENCE` existe en schéma mais pas de table `Competence` ni saisie dédiée | Bloque le socle commun / programmes structurés en savoir-faire | 1–2 sem |
| 🟡 P2 | **Pas de livret comportement** — seules les observations bulletin capturent du qualitatif | Vie scolaire incomplète (participation, discipline, conseil de classe) | 2 j |
| 🟡 P2 | **Pas de workflow « Préparer la rentrée »** — décision progression calculée mais réinscription manuelle | Charge administrative en fin d'année | 1 j |
| 🟢 P3 | **Pas de branches/options** (latin, filières lycée) | Limite l'extension collège-lycée | 3 j |
| 🟢 P3 | **Pas de lien programme officiel ↔ matières** (`programme_url`, objectifs nommés) | Référentiel pédagogique non traçable | 2 h |
| 🟢 P3 | **Soldes de congés personnel** — demandes d'absence sans compteur `solde_conges_jours` | Module RH incomplet | 4 h |
| 🟢 P3 | **Mentions bulletin** : `libelle_fr` seulement dans la table `Mention` — pas de `libelle_ar` | Incohérence sur bulletins AR | 2 h |

### Verdict pédagogique

Le produit couvre **>95 % des besoins** d'une école franco-arabe primaire/collège au Sénégal. Le différenciateur (double filière, IEF, bulletins combinés, portail parents) est réel et rare sur le marché. Les manques restants sont des **extensions de marché** (compétences, collège-lycée), pas des blocages opérationnels.

---

## 2. Cybersécurité — 8,5/10

### Posture actuelle (points forts)

| Mesure | Détail | Référence |
|--------|--------|-----------|
| JWT fail-fast | Refus de démarrer si `JWT_SECRET` absent | `backend/src/config/env.ts` |
| QR_SECRET validé | Zod `.min(32)` + fail-fast au boot | `backend/src/config/env.ts` |
| Token httpOnly | JWT **jamais** en localStorage — cookie `daaragest_token` uniquement | `frontend/src/store/authStore.ts` |
| Multi-tenant strict | `etablissement_id` extrait du JWT, filtré dans tous les services | Tous les `*.service.ts` |
| Mots de passe | bcrypt cost 10 + regex maj/min/chiffre/spécial | `backend/src/utils/passwordPolicy.ts` |
| Refresh tokens | Révocables en base | `schema.prisma` — `RefreshToken` |
| Rate limiting | Global 100/15 min · login 5/min · portail 30/min | `backend/src/server.ts` |
| Headers sécurité | HSTS, X-Frame-Options, CSP (strict prod / Report-Only dev) | `backend/src/server.ts` |
| XSS PDF | `escapeHtml()` sur variables utilisateur | `backend/src/utils/escapeHtml.ts` |
| Autorisation horizontale | `teachingPolicy.ts` — prof limité à ses classes/matières | `backend/src/utils/teachingPolicy.ts` |
| Portail parent | Expiration alignée sur fin d'année, rate-limit, révocation | `portail-parent.service.ts` |
| Soft-delete élèves | `bulkSupprimerEleves` conserve historique (notes, bulletins, paiements) | `eleves.service.ts:306-325` |
| Audit log | 21+ appels `logAction()` sur opérations sensibles | `backend/src/utils/audit.ts` |
| Logger redacté | Mots de passe et cookies masqués | `backend/src/server.ts` |

### Lacunes résiduelles

| Priorité | Risque | Détail | Effort |
|----------|--------|--------|--------|
| 🟠 P1 | Refresh token rotation destructive | Chaque login révoque *tous* les tokens actifs → bloque multi-device et app mobile | `auth.service.ts:138` · 0,5 j |
| 🟡 P2 | Pas de CSRF explicite | Cookie httpOnly + SameSite atténuent, mais pas de token CSRF sur mutations | 0,5 j |
| 🟡 P2 | Brute-force login | Rate-limit 5/min mais pas de verrouillage IP progressif / captcha | 0,5 j |
| 🟡 P2 | Mots de passe seed prévisibles | `Admin123!` documenté — `must_change_password` aide mais reste un vecteur à l'install | `seed.ts` · 1 h |
| 🟢 P3 | RBAC frontend contournable | `ProtectedRoute` lit le rôle en localStorage — le backend compense | `ProtectedRoute.tsx` |
| 🟢 P3 | `$executeRawUnsafe` pour séquences matricule | Surface SQL réduite mais présente | `eleves.service.ts` · 0,5 j |
| 🟢 P3 | README sécurité obsolète | Section « Sécurité » mentionne encore `localStorage` pour le JWT — **en contradiction avec le code** | `README.md` · 1 h |

### Verdict cybersécurité

Niveau **enterprise pour un SaaS éducatif multi-tenant**. Les 4 critiques de l'audit initial (secrets hardcodés, XSS PDF, JWT localStorage, domaine cookie) sont **fermées**. Il reste surtout de la **défense en profondeur** (CSRF, multi-device) et de la **documentation à jour**.

Une fois le refresh token par device + mise à jour README traités, la posture monte à **~9/10**.

---

## 3. Ingénierie conceptuelle — 8/10

### Architecture backend (exemplaire)

```
controller → service → routes → schema (Zod) → test
```

**Points forts :**

- **50 modèles Prisma**, **41+ indexes** multi-tenant
- Pattern modulaire cohérent sur ~36 modules
- **Pool Puppeteer** (`MAX_CONCURRENT=3`) pour les PDF — `backend/src/utils/browserPool.ts`
- **Cache LRU maison** (5 min TTL) sur lectures read-mostly — `backend/src/utils/cache.ts`
- **Healthcheck** multi-composant (`/health` : DB + Puppeteer)
- **CI GitHub Actions** : type-check, lint backend, tests unitaires + intégration Postgres, build — `.github/workflows/ci.yml`
- **484 tests** Vitest en ~2,7 s — culture qualité backend solide
- **Code-splitting frontend** : 25+ pages en `React.lazy` + `manualChunks` Vite + reload auto sur chunks périmés — `frontend/src/App.tsx`
- **Config env centralisée** : Zod fail-fast — `backend/src/config/env.ts`
- **ESLint + Prettier** backend intégrés en CI — `backend/.eslintrc.cjs`

### Dette structurelle (qui s'aggrave)

| Problème | Mesure actuelle | Tendance vs mai 2026 |
|----------|-----------------|----------------------|
| Pages frontend monolithiques | `Eleves/index.tsx` **1 637 L**, `Parametres/index.tsx` **1 874 L** | ↑ (était 1 635 / 1 310) |
| Inline styles | ~100+ par page sur les plus grosses | Stable / élevé |
| Tests frontend | **0** (`*.test.tsx`) | Inchangé |
| Observabilité prod | Pas de Sentry / Prometheus / OTel | Inchangé |
| Cache PDF | Puppeteer relancé à chaque téléchargement | Inchangé |
| TanStack Query | `useApi` custom, pas de cache/retry/dedup | Inchangé |
| ESLint frontend | Absent | Inchangé |
| Erreurs métier | Mix `throw new Error()` + seul `ForbiddenError` | Hétérogène |
| Champs `Json` Prisma | Pas de schéma Zod versionné (`noms_periodes`, `cibles_roles`…) | Drift possible |
| README tests | Indique « 428 tests » — **obsolète** (484 réels) | Doc drift |

### Découpage frontend recommandé

```
Eleves/
  index.tsx              (orchestrateur, < 200 lignes)
  EleveList.tsx          (table + pagination)
  EleveFilters.tsx       (search, sort, classe filter)
  EleveFormModal.tsx     (create/edit)
  EleveImportModal.tsx   (CSV)
  EleveDetailDrawer.tsx
  EleveBulkActions.tsx
```

**Effort** : 1 j par page · **Impact** : maintenabilité, perfs, testabilité.

### Verdict ingénierie

**Backend production-ready** avec une trajectoire saine (CI, tests, cache, indexes). Le **frontend est le goulot** : croissance linéaire des fichiers géants sans découpage, sans tests, sans couche data moderne. À 50+ établissements, l'absence d'observabilité deviendra critique.

---

## 4. Design — 8,5/10

### Identité graphique (force majeure)

Système de design **singulier**, ancré dans la culture du *daara* :

| Élément | Détail |
|---------|--------|
| Palette | Papier chaud `#FAF6EE`, encre `#1B1812`, terracotta `#B85433`, sahel (or), indigo (cachet) |
| Typo | Fraunces (titres), Instrument Sans (UI), JetBrains Mono (matricules), Noto Naskh (RTL) |
| Dark mode | 36 variables inversées, persistant par utilisateur |
| RTL natif | Propriétés logiques CSS, basculement instantané |
| Tokens | 47+ variables, échelles `--space-*` et `--text-*` centralisées — `frontend/src/index.css` |
| a11y | WCAG AA sur `--ink-3` (4,51:1), `prefers-reduced-motion`, quelques `aria-label` |
| Logo | Monogramme `<LogoIcon />` + planchette *lawh* `<LogoMark />` |

Composants UI maison cohérents : `Button`, `Modal`, `Table` (skeleton), `Badge`, `Toast`, `NotificationBell`, `PhotoPicker`, `ConfirmModal`.

### Acquis design validés (mai → juin 2026)

| Constat | État |
|---------|------|
| Tokens fantômes (`--surface-2`, `--border`…) | ✅ Aliasés dans `index.css` |
| `@keyframes pulse` / `spin` | ✅ Globaux |
| Scanner QR hors palette | ✅ Repeint aux tokens daara |
| Échelles `--space-*` / `--text-*` | ✅ Définies |
| EmploiDuTemps couleurs Tailwind | ✅ Migré vers tokens daara |
| `#fff` hardcodés | 🟡 ~35 restants (était 46) |
| `aria-label` / tabs ARIA | 🟡 Partiel (~20 occurrences) |

### Lacunes design restantes

| Priorité | Constat | Effort |
|----------|---------|--------|
| 🟠 P1 | **Inline styles massifs** — valeurs magiques au lieu des tokens `--space-*` / classes | 1 j/page |
| 🟡 P2 | **Accessibilité partielle** — beaucoup de boutons icône sans `aria-label`, tabs incomplets | 0,5 j |
| 🟡 P2 | **Tailwind non arbitré** — config présente, quasi inutilisée (poids bundle sans bénéfice) | 2 h – 5 j |
| 🟡 P2 | **Tailles texte petites** — badges/labels à 11–12 px, pénible en arabe Naskh | 0,5 j |
| 🟢 P3 | **Pas de PWA** — pas de `manifest.json` ni `apple-touch-icon` | 1 h |
| 🟢 P3 | **Pas de Tooltip** — 8+ `title=` natifs (invisibles sur mobile) | 0,5 j |
| 🟢 P3 | **Pas de Storybook** — design system non documenté visuellement | 1 j |

### Verdict design

**Rendu visuel professionnel et différenciant** — rare pour un outil de gestion scolaire. La dette est **structurelle** (inline styles, a11y) plutôt qu'esthétique. L'identité tient la route en dark mode et en RTL.

---

## Cartographie fonctionnelle

```
┌─────────────────────────────────────────────────────────────┐
│                      COUCHE PUBLIQUE                        │
│  Landing Page (FR/AR)          Portail Parent (UUID)        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    AUTHENTIFICATION                           │
│  Cookie httpOnly JWT  ·  RBAC par rôle  ·  teachingPolicy     │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  ACADÉMIQUE   │  │    ADMIN      │  │ COMMUNICATION │
│ Élèves        │  │ Finances      │  │ Messagerie    │
│ Notes         │  │ Personnel     │  │ Notifications │
│ Bulletins PDF │  │ Pointage      │  │ Calendrier    │
│ Évaluations   │  │ Documents     │  │ Emploi temps  │
│ Progression   │  │ Bibliothèque  │  │               │
│ Rapports IEF  │  │ Paramètres    │  │               │
└───────────────┘  └───────────────┘  └───────────────┘
```

---

## Priorisation transversale

| # | Action | Axe(s) | Effort | Impact |
|---|--------|--------|--------|--------|
| 1 | Découper `Eleves/` et `Parametres/` en sous-composants | Ingé + Design | 2–3 j | Maintenabilité |
| 2 | Refresh token par `device_id` | Sécu | 0,5 j | Débloque mobile |
| 3 | Mettre à jour README (sécurité, tests, auth flow) | Sécu + Ingé | 1 h | Cohérence doc |
| 4 | Sentry backend + frontend | Ingé | 0,5 j | Observabilité prod |
| 5 | Tests frontend (Vitest + RTL sur Modal, Table, useApi) | Ingé | 1 j | Régression UI |
| 6 | `libelle_ar` sur table `Mention` | Pédago | 2 h | Bulletins AR cohérents |
| 7 | Workflow « Préparer la rentrée » | Pédago | 1 j | Gain fin d'année |
| 8 | Décision Tailwind in/out | Design | 2 h – 5 j | Stack claire |
| 9 | TanStack Query (migration progressive) | Ingé | 2 j | Perf réseau + UX |
| 10 | Évaluation par compétences (refonte modèle) | Pédago | 1–2 sem | Extension marché |

---

## Conclusion

**DaaraGest** est un ERP scolaire **mature fonctionnellement** et **bien sécurisé côté backend**, avec une **identité visuelle remarquable** et un **ancrage pédagogique sénégalais** (IEF, double filière, bulletins combinés) rare dans l'écosystème.

### Les trois chantiers structurants

1. **Maintenabilité frontend** — découpage des pages géantes, réduction des inline styles, tests UI
2. **Observabilité & scale** — Sentry, cache PDF, refresh token multi-device
3. **Extensions pédagogiques** — compétences, livret comportement, rentrée guidée

### Documents connexes

| Fichier | Contenu |
|---------|---------|
| [README.md](../README.md) | Documentation technique complète |
| [Audit/README.md](./README.md) | Index audits mai 2026 + sprints correctifs |
| [01-audit-pedagogique.md](./01-audit-pedagogique.md) | Détail pédagogique (mai 2026) |
| [02-audit-cybersecurite.md](./02-audit-cybersecurite.md) | Détail sécurité (mai 2026) |
| [03-audit-ingenierie-conception.md](./03-audit-ingenierie-conception.md) | Détail ingénierie (mai 2026) |
| [04-audit-visuel-design.md](./04-audit-visuel-design.md) | Détail design (mai 2026) |

---

*Auditeur : Claude — analyse du 7 juin 2026, vérifiée contre le code source à HEAD `f94ead5`.*
