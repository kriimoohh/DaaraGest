# Plan SaaS & Infrastructure — DaaraGest

> **Statut : plan / backlog — non implémenté.** Document de référence à exploiter plus tard.
> **Dernière MAJ : 2026-07-16.** Voir aussi [`PRODUCT.md`](../PRODUCT.md), et en mémoire projet la note *backlog priorisé* (« Phase 4 multi-établissement »).
>
> Objectif : passer de **mono-établissement** (aujourd'hui `etablissement-default` en prod) à un **SaaS multi-tenant** propre, isolé et scalable, avec un choix d'infrastructure plus stable et maîtrisé en coût que l'hébergement actuel (Railway).

---

## 1. Aptitude au SaaS — état des lieux (vérifié dans le code)

Le socle multi-tenant existe déjà à ~80 %. Ce n'est **pas une réécriture**, c'est du durcissement + provisioning + infra.

| Aspect | État actuel | Verdict |
|---|---|---|
| Modèle de données | 57 modèles Prisma, **100+ références `etablissement_id`** — tout est clé par tenant | ✅ Prêt |
| Résolution du tenant | `etablissement_id` **dans le JWT** → `request.user.etablissement_id` → passé aux services | ✅ Prêt |
| Hardcoding mono-tenant | **0** `etablissement-default` dans `src/` (uniquement seed/tests) | ✅ Prêt |
| Scoping des requêtes | `where: { id, etablissement_id }` **manuel, à chaque requête** | ⚠️ Fragile |
| Isolation centralisée | **Aucune** (pas de RLS Postgres, pas de middleware Prisma `$extends`/`$use`) | ❌ À faire |
| Onboarding / création d'établissement | **Inexistant** (établissement créé par seed uniquement) | ❌ À faire |
| Facturation / abonnements / quotas | Inexistant | ❌ À faire |
| Stockage fichiers | Photos/logos en **base64 (data URL) dans la base** (`src/utils/photoUrl.ts`) | ❌ À changer |
| Génération PDF | **Puppeteer synchrone** par requête (`renderPdfHtml`) | ⚠️ Goulot à isoler |
| Infra | 1 service Docker + 1 Postgres (Railway), `prisma migrate deploy` au boot | ⚠️ À faire évoluer |
| Rate-limiting | Par utilisateur + IP (1 école = 1 IP publique) | ⚠️ Passer par tenant |
| Observabilité | Sentry actif (back+front), ne capte que les 5xx | ✅ Base OK |

**Conclusion :** apte. L'effort porte sur (a) rendre l'isolation **étanche**, (b) **industrialiser** (onboarding/facturation), (c) **mettre à l'échelle** (stockage objets, pooling, worker PDF).

---

## 2. Stratégie multi-tenancy

Trois modèles possibles :

| Modèle | Isolation | Coût / ops | Verdict pour DaaraGest |
|---|---|---|---|
| **DB partagée + isolation par ligne** (actuel) | Logique (`etablissement_id`) | Très bas | ✅ **Recommandé par défaut** |
| Schéma par tenant | Moyenne | Moyen | Option intermédiaire, rarement utile |
| **1 base par établissement** | Physique, totale | **Élevé** | ❌ Seulement offre « entreprise » à la demande |

### Pourquoi PAS « une base par école » comme défaut
- **Migrations × N** : chaque changement de schéma doit tourner sur *toutes* les bases → orchestration, dérives, échecs partiels. Aujourd'hui 1 migration au merge ; avec 300 écoles = 300 exécutions à surveiller.
- **Coût & connexions** : chaque base = coût fixe + pool de connexions. 300 bases quasi-inactives = gouffre financier + saturation de connexions.
- **Ops & analytics cross-tenant** (facturation, supervision, support) deviennent pénibles.
- Le **gain de sécurité est marginal** dès qu'on met du **RLS Postgres** sur la base partagée.

### Décision retenue
**DB partagée + Row-Level Security (RLS) Postgres**, avec « base dédiée » gardée comme **option premium** future (hybride : mutualisé par défaut, dédié à la demande pour un gros client réglementé).

---

## 3. Chantiers par thème

### 3.1 Isolation (priorité absolue — AVANT le 2ᵉ tenant)
- **RLS PostgreSQL** : politique `USING (etablissement_id = current_setting('app.etab')::uuid)` sur chaque table tenant, + `SET LOCAL app.etab = '<id>'` en début de chaque transaction (valeur issue du JWT). → un `where` oublié **ne peut plus** fuiter chez un autre établissement (défense en profondeur).
- Complément applicatif : **extension Prisma `$extends`** qui injecte `etablissement_id` automatiquement dans chaque `where`/`create`.
- **Tests d'isolation** automatisés en CI (« le tenant A ne voit jamais les données de B ») — la suite d'intégration Postgres existe déjà, à étendre.

### 3.2 Provisioning & facturation
- Flux d'inscription établissement (signup) + **seed par défaut** automatique (config notes, mentions, filières, année scolaire, compte admin).
- Sous-domaine ou slug par tenant (`ecole-x.daaragest.app`) ; **console super-admin** ; statut tenant (essai / actif / suspendu).
- Abonnement + quotas (nb élèves, stockage). Marché sénégalais → prévoir **mobile money** (Wave / Orange Money) en plus de la carte.

### 3.3 Données
- **Sortir les images de la base** (base64 → **object storage** + URLs signées + CDN). Critique : le base64 en Postgres fait exploser taille, backups et perfs.
- Export / suppression par tenant (RGPD-like, **CDP Sénégal**), rétention, soft-delete.
- **Index composites `(etablissement_id, …)`** sur toutes les requêtes chaudes.

### 3.4 Infra / scalabilité
- **Pooling de connexions** (PgBouncer / Prisma Accelerate, ou Postgres qui pool nativement) — `PrismaClient` × N instances sature vite Postgres.
- **PDF (Puppeteer) en worker séparé + file d'attente** (BullMQ/Redis) : aujourd'hui synchrone et lourd → 1ᵉʳ goulot à l'échelle.
- **Cache Redis** de la config/mentions/filières par tenant.
- **Rate-limiting par tenant** (incident « 1 école = 1 IP » déjà rencontré).
- API stateless → **réplicas horizontaux** ; **CDN** pour le front (build Vite statique).

### 3.5 Observabilité & conformité
- Tag **Sentry / logs par `etablissement_id`**, audit log, feature flags, rollouts progressifs, alerting.
- Chiffrement au repos, pen-test de l'isolation, plan sauvegarde/restauration par tenant.

---

## 4. Infrastructure cible

### Principe clé : découpler
La stabilité d'un SaaS se joue surtout sur **la base de données**. **Ne pas faire tourner le Postgres de prod sur le même PaaS que l'app.** On sépare :
- **Base** → Postgres managé sérieux (backups + PITR + pooling).
- **API + worker PDF** (conteneur Docker stateless) → hébergeur mûr.
- **Fichiers** → object storage + CDN.
- **Front** (build Vite statique) → CDN pur.

L'app est **déjà conteneurisée** (`Dockerfile` `node:20-alpine`) → **portable**, changer d'hébergeur = faible risque (`pg_dump`/restore + repointer `DATABASE_URL`).

### Contraintes propres à DaaraGest
| Contrainte | Impact |
|---|---|
| **Puppeteer** (PDF) | Besoin d'un **conteneur** faisant tourner Chromium → serverless pur (Vercel/Lambda) pénible → **worker persistant**. |
| **Latence Sénégal** | Aucune région africaine chez la plupart → **Paris (EU)** = meilleur compromis. |
| **Résidence données** (CDP Sénégal / RGPD) | Pousse vers région/fournisseur **EU** (Paris). |
| **Petite équipe, coût sensible** | Éviter le full-AWS trop tôt ; privilégier le managé simple ou le VPS + Kamal. |

### Trois stacks candidates
- **Stack A — Managé pragmatique** (le moins d'ops)
  - DB : **Neon** ou **Supabase** (Postgres managé EU, pooling intégré, PITR ; Neon = serverless + branching pour la CI).
  - API + worker : **Render** (réputé plus stable/mûr que Railway) ou **Fly.io** (multi-région, instances proches des users, tourne Docker/Puppeteer nativement).
  - Fichiers : **Cloudflare R2** (egress gratuit + CDN).
  - Front : **Cloudflare Pages** (gratuit).

- **Stack B — Coût maîtrisé EU** (adapté au contexte africain)
  - VPS **Hetzner** ou **Scaleway** (région Paris) + déploiement **Kamal** (37signals) ou **Coolify**.
  - DB : **Scaleway Managed PostgreSQL (Paris)** ou **Neon** (garder la DB managée même sur un VPS app).
  - Fichiers : **Cloudflare R2**. Front : **Cloudflare Pages**.

- **Stack C — Cloud-native** (endgame à l'échelle / conformité forte)
  - **AWS Paris (eu-west-3)** ou **Scaleway** : conteneurs (App Runner / ECS Fargate / Scaleway Containers) + **RDS/Aurora** + **S3** + **CloudFront**. Ops réelle → seulement quand l'échelle/compliance l'imposent.

---

## 5. Coûts estimés (recherche, mi-2026, HT)

> ⚠️ **Estimations d'ordre de grandeur**, prix publics vérifiés mi-2026 (changements fréquents : Scaleway a bougé au 01/06/2026, Hetzner au 15/06/2026, Neon a baissé fin 2025). Prix EU **hors taxes**. À reconfirmer sur les pages officielles (§ Sources) au moment du choix.

### 5.1 Prix unitaires des briques

| Brique | Option | Prix approx. |
|---|---|---|
| **DB managé** | Neon (serverless) | Free (0.5 GB) · Launch $0.106/CU-h + $0.35/GB · Scale $0.222/CU-h → petit prod réaliste **~$20–40/mo** |
| | Supabase | Pro **$25/mo** (Micro inclus) ; add-ons Small +$5, Medium +$50, Large +$100 ; Team $599 |
| | Scaleway PG (Paris) | DEV-S (1 vCPU/2 GB) **~€11** · PRO2-XXS (2 vCPU/8 GB) **~€80** (HA ~€123) · PRO2-XS (4 vCPU/16 GB) ~€158 |
| | AWS RDS (Paris) | db.t4g.medium (2 vCPU/4 GB) **~$47/mo** + stockage/backup (×~2 en Multi-AZ) |
| | Fly Managed PG | Basic (1 GB) $38 · Starter (2 GB) $72 · Launch (8 GB) $282 |
| **API / worker** | Render | Starter **$7/service** (512 MB/0.5 vCPU) · Standard $25+/service · workspace Pro $25 (autoscaling) · bande passante $0.15/GB au-delà |
| | Fly.io | ~**$3–5/machine** (512 MB–1 GB) · +IPv4 $2 · egress $0.02/GB (free tier supprimé) |
| | Hetzner VPS | CX22 (2 vCPU/4 GB) **€3.79** · CPX21 (3/4) ~€8 · CPX31 (4/8) ~€15 · CPX41 (8/16) ~€28 |
| **Object storage** | Cloudflare R2 | **$0.015/GB**, **egress GRATUIT**, 10 GB gratuits/mois |
| **Front / CDN** | Cloudflare Pages | **Gratuit** (statique, bande passante illimitée) |
| **Redis (queue/cache)** | Upstash (serverless) | pay-per-use, petit usage **~$0–10/mo** |

### 5.2 Estimation mensuelle par palier

Hypothèses : API + worker PDF + DB + object storage + front. Redis inclus dès « croissance ».

| Palier | Stack A — Managé | Stack B — Coût maîtrisé EU |
|---|---|---|
| **Pilote** (1–10 écoles, ~1–3 k élèves) | **~$45–60/mo** (Neon/Supabase $25–30 + Render 2×$7 + R2 ~$1 + Pages 0) | **~€20–30/mo** (1 VPS CPX31 ~€15 + Scaleway DEV-S €11, ou tout sur 1 VPS + backups R2) |
| **Croissance** (10–50 écoles, ~5–15 k élèves) | **~$120–200/mo** (DB Small/Medium + 2 services Standard + workspace Pro + Redis + R2) | **~€110–160/mo** (VPS CPX41 + Scaleway PRO2-XXS €80/HA €123 + Redis + R2) |
| **Échelle** (100–300 écoles, ~30–80 k élèves) | **~$400–800/mo** (DB Scale/Large-XL + 2–3 instances + workers + pooling + Redis + R2) | **~€300–600/mo** (2–3 VPS + Scaleway PRO2-XS HA + Redis + R2) |

> Stack C (AWS/Scaleway full-managé) à l'échelle : **~$800–1500/mo**, plus d'ops mais conformité/scalabilité maximales.
>
> **Remarque** : le coût réel dépend surtout (1) du **stockage des photos** (d'où l'importance de R2 vs base64) et (2) du **volume de génération PDF** (d'où le worker + queue). Le front (Cloudflare Pages) et l'egress (R2) sont quasi gratuits.

---

## 6. Recommandation & décision

**Setup recommandé (défaut) :**
> **Postgres managé (Neon ou Scaleway Paris) + API/worker sur Render ou Fly.io + images sur Cloudflare R2 + front sur Cloudflare Pages + Redis (Upstash).**

Le geste **le plus impactant pour la stabilité**, indépendamment de l'hébergeur : **sortir le Postgres de prod du PaaS applicatif** vers une base managée avec **PITR + pooling**. Le reste (Railway → Render/Fly) est secondaire et rapide grâce au Docker.

**Matrice de décision :**
| Priorité | Choix |
|---|---|
| Simplicité / petite équipe | **Neon + Render + R2 + CF Pages** |
| Coût + résidence EU + contrôle | **Hetzner + Kamal + Scaleway DB + R2 + CF Pages** |
| Conformité / scale entreprise | **AWS Paris (RDS + Fargate + S3 + CloudFront)** ou Scaleway full-managé |

À ce stade (1 → N écoles), je recommande de **commencer Stack A** (managé, faible ops) et de garder **Stack B** en tête si la pression coût/résidence augmente. **DB-par-tenant : non** par défaut ; RLS sur base partagée suffit.

---

## 7. Feuille de route

| Phase | Contenu | Prérequis de |
|---|---|---|
| **A — Isolation** | RLS Postgres + extension Prisma + tests d'isolation CI | Ouvrir à un 2ᵉ établissement |
| **B — Provisioning + facturation** | Signup établissement, seed auto, super-admin, plans/quotas, mobile money | Vente en libre-service |
| **C — Données + infra** | Object storage (R2), pooling, worker PDF + queue, cache Redis, bascule hébergeur | Charge réelle multi-tenant |
| **D — Scale / ops** | Autoscale, observabilité par tenant, option base dédiée « entreprise », conformité | Croissance / gros clients |

**Ordre non négociable :** la **Phase A** doit être terminée **avant** d'accueillir un second établissement en prod (risque de fuite inter-tenant).

---

## 8. Risques & questions ouvertes
- **Résidence des données** : exigence légale Sénégal (CDP) à confirmer → conditionne EU-Paris vs autre.
- **Migration hébergeur sans coupure** : `pg_dump`/restore + fenêtre de bascule (DNS/`DATABASE_URL`) → à scripter.
- **Puppeteer en worker** : refactor de `renderPdfHtml` vers une file asynchrone (impact UX : PDF « en préparation »).
- **RLS + Prisma** : valider le pattern `SET LOCAL` par transaction avec le pooling (PgBouncer en mode transaction).
- **Facturation** : intégration Wave/Orange Money (disponibilité API, KYC).

---

## Sources (prix, mi-2026)
- Neon — <https://neon.com/pricing>
- Supabase — <https://supabase.com/pricing>
- Render — <https://render.com/pricing>
- Fly.io — <https://fly.io/docs/about/pricing/> · Managed Postgres <https://fly.io/docs/mpg/>
- Cloudflare R2 — <https://developers.cloudflare.com/r2/pricing/>
- Cloudflare Pages — <https://developers.cloudflare.com/pages/functions/pricing/>
- Scaleway — <https://www.scaleway.com/en/pricing/>
- Hetzner Cloud — <https://www.hetzner.com/cloud>
- AWS RDS PostgreSQL — <https://aws.amazon.com/rds/postgresql/pricing/>
