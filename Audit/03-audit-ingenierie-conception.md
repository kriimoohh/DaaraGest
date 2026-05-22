# 03 — Audit Ingénierie & Conception

> Périmètre : architecture logicielle, qualité de code, tests, performances, scalabilité, observabilité, DX, CI/CD.

**Note globale : 7.5/10** (↑ de 7/10) — CI/CD en place, indexes DB déployés massivement (41 vs 7), config env centralisée. Mais le frontend monolithique reste (Eleves 1635 lignes), aucun cache applicatif/PDF, aucune observabilité prod, et toujours pas d'ESLint/Prettier ni de tests frontend.

---

## ✅ Acquis depuis l'audit précédent (2026-05-19)

| Ancien constat | État | Référence |
|---|---|---|
| E2 — Indexation Prisma insuffisante (7 indexes) | ✅ **Corrigé** | **41 indexes** désormais, dont multi-tenant systématique (Eleve, Classe, Matiere, Utilisateur, Notification, etc.). Migration `20260520000000_add_perf_indexes` |
| E3 — Migration timestamp corrompu | 🟡 **Toléré** | `20260519400000_carte_id_qr_token` toujours présente, mais entourée par 7 migrations postérieures (May 20–22) qui ont validé son application. Pas de blocage immédiat |
| E4 — Pas de CI/CD | ✅ **Corrigé** | [.github/workflows/ci.yml](../.github/workflows/ci.yml) : job backend (type-check, tests, build) + frontend (type-check, build) sur push main + PR. Concurrency cancel + cache npm |
| E7 — `$executeRawUnsafe` séquences matricule | ❌ **Non corrigé** | [eleves.service.ts:174](../backend/src/modules/eleves/eleves.service.ts#L174) — toujours présent |
| E10 — `dist/` traqué par git | ✅ **Corrigé** | `git ls-files backend/dist frontend/dist` → 0 fichier |
| E11 — Variables d'env non centralisées | ✅ **Corrigé** | [config/env.ts](../backend/src/config/env.ts) — Zod validation stricte, fail-fast au boot, fallback test-safe |
| E18 — Notes : pas de validation prof ∈ classe | ✅ **Corrigé** | [teachingPolicy.ts](../backend/src/utils/teachingPolicy.ts) (cf. Sécu H1) |

## 🆕 Améliorations à noter

- **Tests** : 428 ✅ → **461 ✅** en **1.42s** (de 2.7s) — couverture étendue + perfs améliorées
- **Migrations Prisma** : 9 → **29** (refactor `Personnel`, fonctions configurables, contrats personnel, sexe utilisateur, domaines/grilles IEF, indexes de perf)
- **Modules backend** : 27 → **33** (+ `personnel`, `demandes-absence-personnel`, `evaluations`, `fonctions`, `rapports`, `progression`)

---

## ✅ Points forts inchangés

- **Architecture backend MVC modulaire** — pattern `controller / service / routes / schema / test` systématique
- **Typage TypeScript strict** — aucun `any` toléré, Zod aux frontières HTTP, payload JWT revalidé à chaque requête
- **Pool Puppeteer maison** ([browserPool.ts](../backend/src/utils/browserPool.ts)) avec `MAX_CONCURRENT=3`
- **N+1 optimisations** documentées et maintenues (bulletins fetch groupé, finances groupBy, eleves progression batchée)
- **Healthcheck multi-composant** : `/health` teste DB + Puppeteer, renvoie 207 si dégradé ([server.ts:101-117](../backend/src/server.ts#L101))
- **Documentation** : `README.md` exhaustif + dossier `Audit/`

---

## 🔴 Dette structurelle restante

### E1 — Composants frontend monolithiques (aggravation)

| Page | Lignes (HEAD) | Δ vs audit précédent |
|---|---|---|
| [Eleves/index.tsx](../frontend/src/pages/Eleves/index.tsx) | **1635** | +35 |
| [Parametres/index.tsx](../frontend/src/pages/Parametres/index.tsx) | **1310** | +182 |
| [Classes/index.tsx](../frontend/src/pages/Classes/index.tsx) | 1081 | = |
| [Documents/index.tsx](../frontend/src/pages/Documents/index.tsx) | **926** | +84 |
| [Finances/index.tsx](../frontend/src/pages/Finances/index.tsx) | 864 | = |
| [Personnel/index.tsx](../frontend/src/pages/Personnel/index.tsx) | **824** | nouveau (refactor) |

La dette **augmente** au lieu de décroître. Plus aucun découpage en sous-composants n'a été initié. **Inline styles** :
- Eleves : **125** occurrences (vs 124)
- Parametres : **110** occurrences (vs 101)
- Documents : 94
- Dashboard : 44

**Fix :** découper en sous-composants par responsabilité :
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

**Effort :** 1 j par page · **Impact :** maintenabilité, perfs, testabilité.

---

### E2 — Aucun cache applicatif ni cache PDF
- Aucune dépendance `lru-cache` détectée
- `parametres`, `niveaux`, `matieres`, `Etablissement.logo_url`, `ConfigNotes.nb_periodes` relus à chaque génération de PDF (sur un export classe entière = 200 bulletins, ~2000 requêtes redondantes)
- Aucun cache disque/S3 sur les PDFs eux-mêmes — chaque téléchargement relance Puppeteer

**Fix :**
1. Cache mémoire LRU 5 min sur lectures `Etablissement`, `ConfigNotes`, `Matiere`, `Niveau` (read-mostly)
2. Cache PDF par `bulletin_id` (clé : `bulletin_id + updated_at`) avec invalidation sur changement note/observation
3. Signature SHA-256 stockée dans `Bulletin.pdf_hash`

**Effort :** 1 j · **Impact :** -90% latence re-téléchargement, -40% requêtes DB sur exports.

---

### E3 — Pas d'ESLint ni de Prettier
- Aucun fichier `.eslintrc*` ou `eslint.config.*` détecté
- Pas de `npm run lint` dans `package.json`
- Pas de Husky / lint-staged
- La CI ne lint pas

**Risque :** style cohérent visuellement mais pas garanti, conventions futures non protégées, code reviews qui doivent vérifier des règles que l'outil ferait.

**Fix :** ajouter `eslint-config-typescript` + Prettier + script CI :
```yaml
- name: Lint
  working-directory: backend
  run: npm run lint
```

**Effort :** 1 h · **Impact :** cohérence long terme + auto-fix.

---

### E4 — Pas d'observabilité production
- Aucun Sentry, OpenTelemetry, Prometheus, Datadog
- Pas d'endpoint `/metrics` (seul `/health` existe)
- Pas de métrique métier (bulletins/mois, PDFs/jour, latence p95, taux d'erreur par module)
- À 50+ établissements, opérer à l'aveugle

**Fix minimal :**
1. Sentry pour les erreurs (`@sentry/node` + `@sentry/react`) avec capture des `setErrorHandler`
2. Endpoint `/metrics` Prometheus avec compteurs : `daaragest_pdf_generated_total`, `daaragest_login_failed_total`, `daaragest_bulk_delete_eleves_total`

**Effort :** 0.5 j · **Impact :** détection précoce des incidents.

---

### E5 — Aucun test frontend
- 461 tests backend en 1.42s ✅
- **0 tests frontend** (aucun `*.test.tsx` ni `*.spec.tsx`)
- Composants comme `Modal`, `Table`, `ActionMenu`, `Toast`, hooks `useApi`, `useTheme` non couverts
- Logique métier UI (filtres, formulaires CSV, calculs locaux) non testée

**Fix :** introduire Vitest + React Testing Library + Playwright pour les flows critiques.

**Effort :** 0.5 j pour le setup + 2-3 j de tests des composants UI · **Impact :** parité de couverture.

---

### E6 — Pas de TanStack Query / SWR
[useApi.ts](../frontend/src/hooks/useApi.ts) custom → pas de cache, pas de retry, pas d'optimistic update, pas de stale-while-revalidate, pas de dedup automatique. Conséquences observables :
- Chaque navigation refetch toutes les données
- Sidebar refetch les compteurs élèves/profs/classes alors que Dashboard les avait déjà chargés

**Fix :** introduire `@tanstack/react-query` (~14 kb gzip) — gain qualité massif.

**Effort :** 2 j de migration progressive · **Impact :** UX + perf réseau.

---

### E7 — `Record<string, unknown>` pour les `where` Prisma
Toujours présent :
- [eleves.service.ts](../backend/src/modules/eleves/eleves.service.ts) — 1 occurrence
- [finances.service.ts](../backend/src/modules/finances/finances.service.ts) — 3 occurrences

Casse la type-safety Prisma. Drift garanti entre schéma et requêtes.

**Fix :** utiliser `Prisma.EleveWhereInput` / `Prisma.PaiementEleveWhereInput`.

**Effort :** 4 h (refactor service par service) · **Impact :** détection à la compilation des erreurs de filtre.

---

### E8 — Gestion d'erreurs encore hétérogène
Toujours un mix :
- `throw new Error("string")` (la majorité)
- Une seule classe `ForbiddenError` dans [teachingPolicy.ts:4-9](../backend/src/utils/teachingPolicy.ts#L4) (bon début)
- Erreurs Prisma non typées (bien traitées par `setErrorHandler` désormais)

Aucune hiérarchie d'erreurs métier publique (`NotFoundError`, `ValidationError`, `ConflictError`).

**Fix :** étendre la pattern `ForbiddenError` à un fichier dédié `utils/errors.ts` :
```ts
export class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}
export class NotFoundError extends HttpError { constructor(msg = 'Introuvable') { super(404, msg); } }
export class ConflictError extends HttpError { constructor(msg = 'Conflit') { super(409, msg); } }
```

**Effort :** 0.5 j · **Impact :** cohérence + meilleur diagnostic en logs.

---

### E9 — Pas de versioning de schéma JSON
Champs `Json` toujours sans Zod schema :
- `ConfigNotes.noms_periodes`
- `Conversation.cibles_roles`
- `DocumentGenere.parametres`
- `AuditLog.details`

Drift garanti à terme (un dev ajoute un champ, un autre lit l'ancien).

**Fix :** Zod schemas pour ces champs, sérialisation/désérialisation aux frontières du service.

**Effort :** 0.5 j · **Impact :** évite la corruption de données.

---

### E10 — Schémas Zod `.string().min(1)` au lieu de `.uuid()`
Cf. [02-audit-cybersecurite.md → H4](./02-audit-cybersecurite.md#h4--uuid-toujours-absent-des-schemas-zod). Dette toujours présente.

---

### E11 — Migration timestamp `20260519400000` toujours là
**Dossier :** `prisma/migrations/20260519400000_carte_id_qr_token`

Toujours nommée avec un timestamp `40:00:00` invalide. Cependant 7 migrations postérieures (`20260520000000`, `20260521100000` … `20260522120000`) se sont appliquées dessus, donc dans la pratique elle ne bloque plus un fresh deploy : Prisma trie alphanumériquement et l'ordre tient.

**Fix optionnel :** la renommer en `20260519140000_carte_id_qr_token` via `npx prisma migrate resolve` (à coordonner si des envs existent déjà avec l'ancien nom).

**Effort :** 15 min (ou laisser tel quel — risque résiduel faible) · **Impact :** propreté.

---

### E12 — Bundle frontend non splitté
[vite.config.ts](../frontend/vite.config.ts) configure le minimum vital. Pas de code-splitting manuel, pas de `manualChunks`, pas de lazy-loading des pages.

Conséquences :
- Bundle initial = toute l'app (Eleves 1635 L + Parametres 1310 L + …)
- TTI sur connexion 3G (Sénégal) potentiellement long

**Fix :** `React.lazy` + `Suspense` sur chaque page, `manualChunks` pour `recharts`/`html5-qrcode` (libs lourdes utilisées sur 1-2 écrans).

**Effort :** 1 h · **Impact :** TTI -40%.

---

### E13 — Pas de stratégie de versioning API
`/api/v1/...` partout ([server.ts:145](../backend/src/server.ts#L145)) mais aucune documentation de la politique. Breaking changes futurs problématiques (mobile app à venir).

**Fix doc :** documenter dans README la politique :
- Major bump = breaking
- Header `X-API-Deprecation-Date` pour les routes en sunset
- Préfixe `/api/v2` lors d'un changement breaking sans casser v1

**Effort :** 1 h · **Impact :** prépare le scale-out.

---

## 🟡 Conception applicative

### E14 — `$executeRawUnsafe` toujours utilisé pour les séquences matricule
[eleves.service.ts:174](../backend/src/modules/eleves/eleves.service.ts#L174) — crée toujours une séquence Postgres par établissement par année. À 100 établissements × 10 ans = 1000 séquences. Surface SQL inutile.

**Alternative propre :**
```prisma
model MatriculeCounter {
  etablissement_id String
  annee            Int
  last_value       Int @default(0)
  @@id([etablissement_id, annee])
}
```
Puis transaction `findUnique → update last_value++` avec lock optimiste.

**Effort :** 0.5 j · **Impact :** DB propre + 0 SQL brut.

---

### E15 — `process.env` direct dans 2 fichiers hors config
Audit env centralisé OK ([config/env.ts](../backend/src/config/env.ts)), mais 2 accès restent en dehors :
- [eleves.service.ts:7](../backend/src/modules/eleves/eleves.service.ts#L7) — `process.env.QR_SECRET`
- [documents.service.ts:8](../backend/src/modules/documents/documents.service.ts#L8) — idem

Ils valident bien (`throw if !secret`) mais devraient importer `env` :
```ts
import { env } from '../../config/env';
function getQrSecret(): string { return env.QR_SECRET; }
```

**Effort :** 5 min · **Impact :** cohérence DX, type-safety.

---

## 🎯 Priorisation

| Priorité | Action | Effort | Impact |
|---|---|---|---|
| 🟠 P1 | **E3** : ESLint + Prettier + intégration CI | 1 h | Cohérence + auto-fix |
| 🟠 P1 | **E4** : Sentry backend + frontend | 0.5 j | Observabilité essentielle |
| 🟠 P1 | **E15** : `process.env` direct → `env` importé | 5 min | DX + type-safety |
| 🟠 P1 | **E2** : cache LRU sur lectures read-mostly | 2 h | -40% requêtes DB exports |
| 🟠 P1 | **E12** : code-splitting Vite + React.lazy | 1 h | TTI -40% |
| 🟡 P2 | **E2** : cache PDF par bulletin_id | 1 j | -90% latence re-téléchargement |
| 🟡 P2 | **E5** : Vitest + RTL setup + 5 tests composants UI | 0.5 j | Parité couverture |
| 🟡 P2 | **E8** : `utils/errors.ts` hiérarchie typée | 0.5 j | Diagnostic + cohérence |
| 🟡 P2 | **E1** : découper Eleves/index.tsx | 1 j | Maintenabilité |
| 🟡 P2 | **E6** : TanStack Query (migration progressive) | 2 j | UX + perf réseau |
| 🟡 P2 | **E10** : `.uuid()` Zod | 2 h | Validation stricte (cf. Sécu H4) |
| 🟢 P3 | **E1 (autres pages)** : Parametres, Classes, Documents | 4 j | Maintenabilité globale |
| 🟢 P3 | **E7** : `Prisma.XxxWhereInput` partout | 4 h | Type-safety |
| 🟢 P3 | **E9** : Zod schemas pour champs Json | 0.5 j | Évite drift |
| 🟢 P3 | **E14** : remplacer séquences raw par table compteur | 0.5 j | DB propre |
| 🟢 P3 | **E13** : doc politique versioning API | 1 h | Préparer scale-out |
| 🔵 P4 | **E11** : renommer migration timestamp `20260519400000` | 15 min | Propreté |

---

## 📊 Verdict ingénierie

**Trajectoire saine** : la CI ([ci.yml](../.github/workflows/ci.yml)) est en place, les **41 indexes Prisma** verrouillent la perf multi-tenant, [`config/env.ts`](../backend/src/config/env.ts) centralise et valide. Les **461 tests** en 1.42s confirment la culture qualité côté backend.

Mais la **dette frontend s'aggrave** : `Eleves/index.tsx` est passé de 1600 à 1635 lignes, `Parametres` de 1128 à 1310. Aucun découpage n'a été initié. À ce rythme, **maintenabilité ↓** rapidement.

Deux manques tactiques :
- **Pas d'observabilité prod** (Sentry/Prometheus) → naviguer à vue dès 10 établissements
- **Pas de cache PDF** → Puppeteer relancé pour le moindre re-téléchargement

Les **P1 (ESLint + Sentry + cache LRU + code-splitting + env import)** demandent **~1 j cumulé** et débloquent les principaux risques opérationnels. Le frontend monolithique demande plus de temps mais peut se traiter page par page.

Une fois P1 traité, le produit atteint un niveau **production-ready** confortable pour 10-50 établissements ; au-delà, P2 (cache PDF, tests frontend, découpage Eleves) deviennent obligatoires.
