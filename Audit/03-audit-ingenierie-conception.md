# 03 — Audit Ingénierie & Conception

> Périmètre : architecture logicielle, qualité de code, tests, performances, scalabilité, observabilité, DX, CI/CD.

**Note globale : 7/10** — architecture saine, perfs réfléchies, mais composants frontend XXL, indexation DB faible, pas de CI ni d'observabilité.

---

## ✅ Points forts

### Architecture backend MVC modulaire
27 modules backend, chacun avec un découpage clair : `controller / service / routes / schema`. Lisibilité élevée, testabilité élevée.

### Suite de tests exemplaire
- **428 tests Vitest** sans DB (logique pure + Fastify inject), 13 fichiers
- Exécution **2.7 s** — déterministe, rapide, CI-friendly
- Couvre : auth, RBAC, bulletins, pointage, finances, notes, absences, documents, security, integration, métier, validation

### Typage TypeScript strict
- Aucun `any` toléré
- Zod validation aux frontières HTTP
- Payload JWT revalidé à chaque requête ([auth.middleware.ts:13](../backend/src/middlewares/auth.middleware.ts#L13))

### Pool Puppeteer maison
[browserPool.ts](../backend/src/utils/browserPool.ts) avec `MAX_CONCURRENT=3`. Protège la RAM — un point critique pour Puppeteer.

### Optimisations N+1 documentées et appliquées
- Bulletins ([bulletins.service.ts:83-91](../backend/src/modules/bulletins/bulletins.service.ts#L83)) : fetch groupé + map en mémoire
- Stats mensuels ([finances.service.ts:217-232](../backend/src/modules/finances/finances.service.ts#L217)) : groupBy en une requête
- Progression ([eleves.service.ts:113-150](../backend/src/modules/eleves/eleves.service.ts#L113)) : 4 requêtes au lieu de N×4

### Migrations Prisma versionnées
9 migrations + seed idempotent par UUIDs stables ([seed.ts:11-30](../backend/prisma/seed.ts#L11)).

### Healthcheck multi-composant
[server.ts:87-98](../backend/src/server.ts#L87) — `/health` teste DB + Puppeteer, renvoie 207 si dégradé.

### Documentation
[README.md](../README.md) ~750 lignes : tables d'API, schémas, dette technique listée, workflow.

---

## 🔴 Dette structurelle

### E1 — Composants frontend monolithiques

| Page | Lignes |
|---|---|
| [Eleves/index.tsx](../frontend/src/pages/Eleves/index.tsx) | **1600** |
| [Parametres/index.tsx](../frontend/src/pages/Parametres/index.tsx) | 1128 |
| [Classes/index.tsx](../frontend/src/pages/Classes/index.tsx) | 1081 |
| [Finances/index.tsx](../frontend/src/pages/Finances/index.tsx) | 864 |
| [Documents/index.tsx](../frontend/src/pages/Documents/index.tsx) | 842 |

**Problème :**
- Mélange list + form + modal + filtres + state local
- Inline styles disséminés (124 occurrences dans Eleves seul)
- Test unitaire frontend impossible
- Re-render coûteux (un changement de filtre re-rend la page entière)

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

### E2 — Indexation Prisma insuffisante

**Schema :** 7 `@@index` pour **44 modèles**. Le multi-tenant scale par `etablissement_id`, **non indexé** sur :
- `Eleve`, `Classe`, `Matiere`, `Utilisateur`, `Notification`, `Conversation`
- `Creneau`, `EvenementCalendrier`, `DocumentTemplate`, `DocumentGenere`
- `Activite`, `Evaluation`, `AnneeScolaire`, `PortailParentToken` (a `@@unique` mais pas d'index simple)

**Conséquence :** full-table scan dès quelques milliers de lignes par table.

**Fix :** ajouter dans `schema.prisma` :
```prisma
model Eleve {
  // ...
  @@index([etablissement_id])
  @@index([etablissement_id, actif])
}

model Classe {
  // ...
  @@index([etablissement_id, annee_scolaire_id])
}

model Notification {
  // ...
  @@index([destinataire_id, lu, created_at])
}

model PaiementEleve {
  // ...
  @@index([eleve_id, mois, annee])
  @@index([annee, mois])  // pour stats-mensuels
}

model AbsenceEleve {
  // ...
  @@index([etablissement_id, date])
}
```

Puis `npx prisma migrate dev --name add_perf_indexes`.

**Effort :** 30 min + migration · **Impact :** latence divisée par 10-100 sur les listings filtrés.

---

### E3 — Migration Prisma avec timestamp corrompu

**Dossier :** `prisma/migrations/20260519400000_carte_id_qr_token`

`20260519400000` interprété en `YYYYMMDDhhmmss` = `2026-05-19 40:00:00` → **heure invalide** (40h). Soit le timestamp est un compteur séquentiel maison (pas convention Prisma), soit un bug. À renommer en `20260519140000` ou similaire avant tout `migrate resolve` en environnement neuf.

**Effort :** 5 min · **Impact :** évite un crash potentiel sur déploiement fresh.

---

### E4 — Pas de CI/CD

- Aucun `.github/workflows/` détecté
- 428 tests ne tournent **jamais automatiquement**
- Aucune validation PR (lint, type-check, test)
- Aucun pre-commit hook (Husky / lint-staged)

**Fix :** ajouter `.github/workflows/ci.yml` :
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci --prefix backend
      - run: npm test --prefix backend
      - run: npm run build --prefix backend
      - run: npm ci --prefix frontend
      - run: npm run build --prefix frontend
```

**Effort :** 2 h · **Impact :** régression détectée à chaque PR.

---

### E5 — Pas d'ESLint ni Prettier
- Style cohérent visuellement mais pas garanti
- Aucun `npm run lint`
- Conventions à venir non protégées

**Effort :** 1 h pour setup standard · **Impact :** cohérence long terme.

---

## 🟠 Conception applicative

### E6 — Pas de couche permission fine
Cf. [02-audit-cybersecurite.md → H1](./02-audit-cybersecurite.md#h1--autorisation-horizontale-faible-notes--bulletins--évaluations). `ROLE_GROUPS` traite tous les profs identiquement. Manque une `Policy` par module qui consulte `ProfMatiereClasse` / `Inscription`.

**Pattern recommandé :**
```ts
// services/policies/notes.policy.ts
export async function canEditNotes(user: JwtPayload, classe_id: string, matiere_id: string) {
  if (['admin','directeur','gestionnaire'].includes(user.role)) return true;
  if (user.role !== 'professeur') return false;
  return await prisma.profMatiereClasse.findFirst({
    where: { professeur: { utilisateur_id: user.id }, classe_id, matiere_id },
  }) !== null;
}
```

### E7 — `$executeRawUnsafe` pour les séquences matricule
[eleves.service.ts:170](../backend/src/modules/eleves/eleves.service.ts#L170) — crée une séquence Postgres par établissement par année (`seq_matricule_{etab}_{annee}`). À 100 établissements × 10 ans = 1000 séquences encombrant le DB.

**Alternative propre :**
```prisma
model MatriculeCounter {
  etablissement_id String
  annee            Int
  last_value       Int @default(0)
  @@id([etablissement_id, annee])
}
```
Puis transaction `findUnique → update last_value++` avec lock optimiste (`@@version`).

**Effort :** 0.5 j (migration + service) · **Impact :** DB schema propre.

### E8 — Gestion d'erreurs hétérogène
Mix de :
- `throw new Error("string")` (la majorité)
- `Object.assign(new Error(), { statusCode })`
- Erreurs Prisma non typées

Aucune classe d'erreur métier (`NotFoundError`, `ForbiddenError`, `ValidationError`). Le `setErrorHandler` se contente du message brut → fuite info (cf. Sécu H5).

**Fix :** hierarchie d'erreurs maison :
```ts
class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}
class NotFoundError extends HttpError { constructor(msg = 'Introuvable') { super(404, msg); } }
class ForbiddenError extends HttpError { constructor(msg = 'Accès refusé') { super(403, msg); } }
```

### E9 — Frontend : pas de TanStack Query / SWR
[useApi.ts](../frontend/src/hooks/useApi.ts) custom → pas de cache, pas de retry, pas d'optimistic update, pas de stale-while-revalidate, pas de dedup automatique.

Conséquences observables :
- La Sidebar refetch les compteurs élèves/profs/classes au mount alors que le Dashboard les a déjà chargés ([Sidebar.tsx:106-118](../frontend/src/components/layout/Sidebar.tsx#L106))
- Chaque navigation de page refetch les données

**Fix :** introduire `@tanstack/react-query` (~14 kb gzip) — gain qualité massif.

**Effort :** 2 j de migration progressive · **Impact :** UX + perf réseau.

### E10 — `dist/` semble traqué par git
Vu dans `ls -la` initial : `backend/dist/` et `frontend/dist/` présents.

**Fix :** vérifier `.gitignore` et purger via `git rm -r --cached backend/dist frontend/dist`.

### E11 — Variables d'env non centralisées / typées
`process.env.XXX` éparpillé à 11+ endroits dans le backend. Aucun fail-fast unifié, aucun type, aucune doc auto.

**Fix :**
```ts
// config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  QR_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('24h'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_DOMAIN: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
});

export const env = envSchema.parse(process.env);
```

Import `env.JWT_SECRET` partout, typage garanti.

**Effort :** 1 h · **Impact :** sécurité + DX + doc.

### E12 — Pas d'observabilité prod
- Pas de Sentry / OpenTelemetry / Prometheus / Datadog
- Pas de métrique métier (bulletins/mois, PDFs/jour, latence p95, taux d'erreur par module)
- À 100 établissements, opérer à l'aveugle

**Fix minimal :**
1. Sentry pour les erreurs (`@sentry/node` + `@sentry/react`)
2. Endpoint `/metrics` Prometheus (compteurs : `daaragest_pdf_generated_total`, `daaragest_login_failed_total`)

**Effort :** 0.5 j · **Impact :** détection précoce des incidents.

### E13 — `Record<string, unknown>` pour les `where` Prisma
Généralisé dans les services ([eleves.service.ts:24](../backend/src/modules/eleves/eleves.service.ts#L24), [finances.service.ts:25](../backend/src/modules/finances/finances.service.ts#L25), …). Casse la type-safety Prisma. Drift garanti entre schéma et requêtes.

**Fix :** utiliser `Prisma.EleveWhereInput` / `Prisma.PaiementEleveWhereInput`.

**Effort :** 1 j (refactor service par service) · **Impact :** détection compilation des erreurs de filtre.

### E14 — Pas de versioning de schéma JSON
Champs `Json` sans schéma typé :
- `ConfigNotes.noms_periodes`
- `Conversation.cibles_roles`
- `DocumentGenere.parametres`
- `AuditLog.details`

Drift garanti à terme (un dev ajoute un champ, un autre lit l'ancien).

**Fix :** Zod schemas pour ces champs, sérialisation/désérialisation aux frontières du service.

### E15 — Schémas Zod assouplis à `.string().min(1)` au lieu de `.uuid()`
Dette connue (README). Le seed utilise désormais des UUIDs valides v4. Revenir à `.uuid()` est possible sans casser le seed.

**Effort :** 2 h (revue de tous les schémas + tests) · **Impact :** validation stricte.

### E16 — Pas de cache applicatif
`parametres`, `niveaux`, `matieres`, `Etablissement.logo_url` lus à chaque requête → relancé à chaque PDF. Pour 200 bulletins/classe × 10 classes = 2000 requêtes redondantes par export.

**Fix :** cache mémoire LRU 5 min (`lru-cache` package) sur les lectures `Etablissement`, `ConfigNotes`, `Matiere` (read-mostly).

**Effort :** 2 h · **Impact :** -40% requêtes DB sur exports massifs.

### E17 — PDF non cachés / non signés
Chaque téléchargement bulletin = relance Puppeteer. Pour 200 bulletins × 10 classes = 2000 invocations.

**Fix :**
1. Cache disque/S3 du PDF par `bulletin_id`
2. Invalidation sur changement de note ou observation
3. Signature SHA-256 stockée dans `Bulletin.pdf_hash` pour vérifier l'intégrité

**Effort :** 1 j · **Impact :** -90% latence sur re-téléchargement.

### E18 — Notes : pas de validation prof ∈ classe
Cf. Sécu H1.

### E19 — Pas de stratégie de versioning API
`/api/v1/...` partout mais aucune stratégie de migration. Breaking changes futurs problématiques.

**Fix doc :** documenter la politique (Major bump = breaking, Header `X-API-Deprecation-Date` pour les routes en sunset).

---

## 🎯 Priorisation

| Priorité | Action | Effort | Impact |
|---|---|---|---|
| 🟠 P1 | **E2** : ajouter `@@index([etablissement_id])` | 30 min + migration | Lenteur >1000 lignes |
| 🟠 P1 | **E4** : CI GitHub Actions tests + build | 2 h | Régressions silencieuses |
| 🟠 P1 | **E11** : config/env.ts centralisé Zod | 1 h | Fail-fast + doc + sécurité |
| 🟠 P1 | **E3** : renommer migration corrompue | 5 min | Évite crash fresh deploy |
| 🟠 P1 | **E5** : ESLint + Prettier | 1 h | Cohérence |
| 🟠 P1 | **E10** : exclure `dist/` de git | 5 min | Repo propre |
| 🟡 P2 | **E12** : Sentry + endpoint /metrics | 0.5 j | Observabilité |
| 🟡 P2 | **E8** : hiérarchie d'erreurs typées | 0.5 j | Cohérence + sécurité |
| 🟡 P2 | **E1** : découper Eleves/index.tsx | 1 j | Maintenabilité |
| 🟡 P2 | **E9** : TanStack Query | 2 j | UX + perf réseau |
| 🟡 P2 | **E16** : cache lectures parametres/matieres | 2 h | -40% requêtes DB |
| 🟡 P2 | **E17** : cache PDF + invalidation | 1 j | -90% latence re-téléchargement |
| 🟡 P2 | **E15** : revenir à `.uuid()` Zod | 2 h | Validation stricte |
| 🟢 P3 | **E1 (autres pages)** : Parametres, Classes, Finances, Documents | 4 j | Maintenabilité globale |
| 🟢 P3 | **E13** : `Prisma.XxxWhereInput` partout | 1 j | Type-safety |
| 🟢 P3 | **E14** : Zod schemas pour champs Json | 0.5 j | Évite drift |
| 🟢 P3 | **E7** : remplacer séquences raw par table compteur | 0.5 j | DB propre |
| 🟢 P3 | **E19** : doc politique versioning API | 1 h | Préparer scale-out |

---

## 📊 Verdict ingénierie

**Architecture saine** au niveau backend (MVC modulaire + Zod + Prisma), **428 tests verts en 2.7 s** = qualité rare. Les choix de pool Puppeteer, élimination N+1, healthcheck multi-composant témoignent d'une **vraie sensibilité perf**.

Mais la **dette frontend** est sérieuse : `Eleves/index.tsx` à 1600 lignes n'est plus maintenable. L'**absence de CI** est un risque immédiat (régression au prochain merge). L'**indexation DB** plombera la perf dès >2000 élèves par établissement.

Les **P1** demandent ~6 h cumulées et débloquent les principaux risques. Le frontend monolithique (E1) demande plus de temps mais peut se traiter page par page sans urgence.

Une fois P1 + observabilité (E12) traités, le produit atteint un niveau **production-ready** confortable pour 10-50 établissements.
