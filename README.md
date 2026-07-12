# DaaraGest

Application web de gestion scolaire multi-filières (franco-arabe et au-delà : FR / AR / EN + combinaisons, configurables par établissement), conçue pour les établissements au Sénégal. Gestion complète des élèves, du personnel, des classes, notes, bulletins, finances, pointage (manuel et QR), emploi du temps, messagerie interne, bibliothèque et portail parents — interface **trilingue Français / Arabe / Anglais** (RTL pour l'arabe) et landing page publique.

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Identité graphique](#identité-graphique)
- [Installation](#installation)
- [Variables d'environnement](#variables-denvironnement)
- [Comptes par défaut](#comptes-par-défaut)
- [Commandes disponibles](#commandes-disponibles)
- [API Reference](#api-reference)
- [Modules](#modules)
- [Sécurité](#sécurité)
- [Tests & CI](#tests--ci)
- [Roadmap — chantiers en cours](#roadmap--chantiers-en-cours)
- [Dette technique](#dette-technique)

---

## Fonctionnalités

### Fonctionnalités actuelles

| Module | Description |
|--------|-------------|
| **Landing page** | Page d'accueil publique présentant la plateforme, ses modules et les guides par rôle, avec basculement thème |
| **Élèves** | Inscription (N filières via `InscriptionClasse`), fiche complète, matricule auto par établissement `CODE-E-YY-NNN` (ex. `CAAM-E-26-001`), transfert de classe en cours d'année, import CSV en masse, export Excel, opérations bulk (inscrire / désactiver / **supprimer définitivement**, admin), QR carte élève |
| **Personnel** | Comptes liés à un utilisateur, **fonctions configurables** (table `Fonction`), contrats CDD/CDI/stagiaire, état civil et qualifications, affectations matière×classe, QR carte professeur |
| **Filières** | Entité `Filiere` configurable par établissement : FR / AR / EN + combinaisons, N par établissement, langue & sens d'écriture (LTR/RTL), couleur propre |
| **Classes** | Rattachées à une filière et un niveau, capacité, par année scolaire ; duplication ; matières de la classe avec **overrides de coefficient/barème par classe et par période** ; listes PDF |
| **Matières** | Coefficient, note min et **barème de saisie (note max)** par défaut sur la matière, overridables par classe/période ; rattachement à un **domaine pédagogique** ; type Ressource/Compétence pour les grilles IEF |
| **Domaines** | Domaines pédagogiques IEF (Langue & Communication, Mathématiques, ESVS, EPSA…), grilles par groupe de niveau (CI-CP / CE1-CE2 / CM1-CM2) |
| **Notes** | Saisie en masse par classe/matière/période, validation sur le barème effectif, suppression en masse, **politique de saisie configurable pour les professeurs** (leurs matières/classes ou élargi) |
| **Évaluations** | Évaluations formatives (devoir, contrôle, test d'entrée, examen…) avec pondération |
| **Bulletins** | Par filière (FR/AR — EN en cours de généralisation) + **combiné au choix** (`filieres_combine`) + annuel ; moyennes pondérées, **mentions configurables** (par filière et/ou niveau), **échelle d'affichage par niveau** (`Niveau.note_max`), classement, **verrouillage de période** (préflight + déverrouillage direction), **templates HTML éditables** (FR/AR/COMBINE/ANNUEL), export PDF individuel ou classe entière |
| **Mentions** | Table `Mention` configurable : libellés FR/AR, seuils, couleurs ; portée établissement / filière / niveau (résolution filière+niveau > filière > niveau > établissement) |
| **Progression** | Suivi de la progression académique pluriannuelle des élèves |
| **Activités** | Activités parascolaires : inscriptions, séances, présences, évaluation |
| **Absences élèves** | Saisie par classe ou individuelle, justification, statistiques, alertes automatiques au-delà du seuil configurable |
| **Pointage** | Saisie journalière présence/absence/retard/congé du personnel, durée auto, historique, statistiques + **pointage par QR code** : QR signés HMAC par personnel, page publique `/scanner`, régénération des QR |
| **Demandes d'absence personnel** | Demandes de congé/absence du personnel avec workflow de traitement (approbation/refus) |
| **Emploi du temps** | Créneaux horaires par classe/professeur/matière, jours actifs flexibles par établissement, détection de conflits |
| **Calendrier scolaire** | Événements (vacances, examens, réunions, fermetures), navigation mensuelle, vue liste |
| **Notifications in-app** | Cloche avec badge, alertes d'absence, absences professeurs, refresh auto |
| **Messagerie interne** | Conversations filées, tout-à-tout + broadcast par rôle, raccourci Ctrl+Enter |
| **Portail parents** | Page publique sans compte (lien UUID) : notes, paiements, absences, informations de l'élève, **téléchargement des bulletins PDF** |
| **Bibliothèque** | Catalogue des livres, gestion des prêts/retours, suivi du stock et des retards |
| **Finances** | Paiements élèves (mensualités, inscriptions, saisie en masse), reliquats, paiements du personnel, numéros de reçu auto, **exports Excel/PDF**, **catalogue de tarifs configurable** |
| **Documents officiels** | 25 types de documents (certificats, attestations, cartes élève/professeur avec QR, fiches de paie, convocations…) générés en PDF à partir de templates personnalisables, aperçu et génération par lot |
| **Rapports** | Présences (élèves/personnel), résultats par classe, bilan financier, **grilles IEF**, performance par domaine, relevés de notes, propositions de fin d'année, charges du personnel — avec aperçus HTML |
| **Audit** | Journal d'audit « qui fait quoi » : actions CREATE/UPDATE/DELETE par utilisateur et entité (accès direction) |
| **Utilisateurs** | Rôles depuis la DB, réinitialisation de mot de passe, désactivation/réactivation, suppression définitive |
| **Paramètres** | Établissement (code matricule, devise, en-têtes de bulletin FR/AR, logo/signature/cachet), config des notes (échelle, **périodes configurables** : nombre + noms FR/AR trimestres/semestres), niveaux, tarifs, fonctions, mentions, jours de cours, préférences de notifications, rendu des bulletins, politique de saisie des notes |
| **Dashboard** | Statistiques clés, graphique des encaissements (Recharts) + tableau de bord analytique direction |
| **i18n FR/AR/EN** | Interface trilingue (français, arabe, anglais — fallback FR) avec sélecteur de langue et bascule RTL instantanée pour l'arabe |
| **Dark mode** | Persistant par utilisateur, actif dès la page de connexion |
| **Observabilité** | Sentry (backend + frontend) — capture des erreurs 5xx uniquement ; health check `/health` (DB + moteur PDF) |

---

## Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Backend | Node.js + Fastify | **5.x** |
| ORM | Prisma | 5.x |
| Base de données | PostgreSQL | 15+ (CI : 16) |
| Authentification | @fastify/jwt v10 + @fastify/cookie v11 + bcryptjs | cost 10 |
| Rate limiting | @fastify/rate-limit | 10.x |
| Validation | Zod (env + payloads, coerce pour les Decimal Prisma) | 3.x |
| PDF | Puppeteer (+ pdf-lib) | 24.x |
| Excel | ExcelJS | 4.x |
| QR codes | qrcode (backend, signés HMAC) + html5-qrcode (scanner frontend) | — |
| Observabilité | @sentry/node + @sentry/react | 10.x |
| Tests | Vitest + @vitest/coverage-v8 + Testing Library (frontend) | 4.x |
| Frontend | React 18 + Vite 5 | — |
| Styles | Tailwind CSS (darkMode: class) | 3.x |
| État global | Zustand + persist | — |
| i18n | i18next + react-i18next | — |
| Graphiques | Recharts | 3.x |
| Import CSV | PapaParse | — |
| Routing | react-router-dom v6 (flags v7 activés) | — |

> **Note CLI Prisma** : le CLI global peut être en v7.x alors que le projet utilise Prisma v5. Toujours utiliser `./node_modules/.bin/prisma` dans ce projet pour éviter les conflits de version.

---

## Architecture

```
DaaraGest/
├── .github/workflows/ci.yml     # CI : type-check, lint, tests, build, intégration Postgres
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # 54 modèles, multi-tenant etablissement_id
│   │   ├── migrations/          # migrations rejouables depuis zéro (testé en CI)
│   │   ├── seed.ts              # seed de développement (admin + comptes de test)
│   │   └── seed-prod.cjs        # seed idempotent exécuté au boot en production
│   └── src/
│       ├── config/
│       │   ├── env.ts           # validation Zod des variables d'env (fail-fast)
│       │   ├── roles.ts         # ROLE_GROUPS (DIRECTION, GESTION, ACADEMIQUE…)
│       │   └── sentry.ts        # Sentry (no-op si SENTRY_DSN absent)
│       ├── middlewares/         # authMiddleware (return sur 401)
│       ├── utils/               # csrf, browserPool (Puppeteer), microTemplate,
│       │                        #   photoUrl, teachingPolicy…
│       ├── modules/             # 33 modules API
│       │   ├── auth/            # login, refresh, logout, me, change-password, profil
│       │   ├── annees-scolaires/
│       │   ├── filieres/        # entité Filiere (FR/AR/EN…, N par établissement)
│       │   ├── niveaux/         # + échelle d'affichage par niveau (note_max)
│       │   ├── domaines/        # domaines pédagogiques IEF
│       │   ├── classes/         # + matières de classe, overrides par période, PDF listes
│       │   ├── matieres/
│       │   ├── mentions/        # mentions configurables (filière/niveau)
│       │   ├── tarifs/          # catalogue des tarifs facturés aux familles
│       │   ├── fonctions/       # fonctions du personnel configurables
│       │   ├── eleves/          # + import CSV, export Excel, bulk, QR, transfert
│       │   ├── personnel/       # + affectations matière×classe
│       │   ├── notes/           # bulk upsert + bulk suppression
│       │   ├── evaluations/     # évaluations formatives, notes, moyennes
│       │   ├── bulletins/       # FR/AR (+EN en cours) + combiné au choix + annuel,
│       │   │                    #   verrouillage de période, templates éditables, PDF
│       │   ├── absences/        # absences élèves + stats + alertes
│       │   ├── progression/     # suivi pluriannuel
│       │   ├── activites/       # activités parascolaires, séances, présences
│       │   ├── finances/        # paiements, reliquats, exports Excel/PDF, stats
│       │   ├── parametres/      # établissement + configNotes + politique de saisie
│       │   ├── pointage/        # présences manuelles + QR (scan public signé HMAC)
│       │   ├── demandes-absence-personnel/
│       │   ├── utilisateurs/    # + réactivation, suppression définitive, GET /roles
│       │   ├── emploi-du-temps/ # créneaux, conflits, jours actifs
│       │   ├── calendrier/      # événements scolaires
│       │   ├── notifications/   # in-app, marquer lue(s)
│       │   ├── messagerie/      # conversations, messages, broadcast
│       │   ├── portail-parent/  # tokens UUID, accès public, bulletins PDF
│       │   ├── documents/       # templates, génération PDF, aperçu, lots, historique
│       │   ├── stats/           # tableau de bord analytique direction
│       │   ├── rapports/        # présences, résultats, bilan financier, grilles IEF…
│       │   ├── audit/           # journal d'audit (direction)
│       │   └── bibliotheque/    # catalogue livres, emprunts, retours
│       └── server.ts            # Fastify 5 + CORS + CSRF Origin + CSP + rate-limit
│                                #   par utilisateur + gestionnaire d'erreurs + Sentry
│
└── frontend/
    └── src/
        ├── components/
        │   ├── layout/          # Sidebar (role-based), Layout, Header (langue/thème)
        │   └── ui/              # Button, Badge, Table, Modal, Input, Select,
        │                        #   SearchInput, Pagination, ConfirmModal, PageHeader,
        │                        #   ProtectedRoute, NotificationBell
        ├── hooks/               # useApi, useAuth, useTheme
        ├── i18n/fr|ar|en/       # common.json (~1 800 lignes chacun ; AR en cours)
        ├── pages/               # 25 dossiers de pages + Dashboard, Login, Landing,
        │                        #   Scanner (public), PortailParent (public)
        ├── lib/api.ts           # fetch wrapper
        └── store/               # authStore (Zustand + persist)
```

### Modèles Prisma (54)

**Établissement & référentiels**
`Etablissement` · `Filiere` · `Role` · `Utilisateur` · `Fonction` · `Niveau` · `Domaine` · `Tarif` · `ConfigNotes` · `Mention` · `MatriculeCounter`

**Personnel**
`Personnel` · `PersonnelCarte` · `Pointage` · `HeureTravail` · `PresencePersonnel` · `PaiementPersonnel` · `PersonnelMatiereClasse` · `DemandeAbsencePersonnel`

**Académique**
`AnneeScolaire` · `Matiere` · `Classe` · `ClasseMatiere` · `ClasseMatierePeriode`

**Élèves**
`Eleve` · `Parent` · `Inscription` · `InscriptionClasse` · `PaiementEleve` · `Note` · `Bulletin` · `BulletinTemplate` · `AbsenceEleve`

**Évaluations & Progression**
`Evaluation` · `NoteEvaluation` · `ProgressionEleve`

**Activités parascolaires**
`Activite` · `InscriptionActivite` · `SeanceActivite` · `PresenceActivite` · `EvaluationActivite`

**Planification & Communication**
`Creneau` · `EvenementCalendrier` · `Notification`

**Messagerie & Portail**
`Conversation` · `ConversationParticipant` · `MessageConversation` · `PortailParentToken`

**Bibliothèque**
`LivreStock` · `Emprunt`

**Documents officiels**
`DocumentTemplate` · `DocumentGenere`

**Auth & traçabilité**
`RefreshToken` · `AuditLog`

### Isolation multi-établissements

Chaque requête authentifiée extrait `etablissement_id` du JWT. Tous les services filtrent par cet identifiant — aucune donnée d'un autre établissement n'est accessible.

### Rôles et accès (navigation)

| Rôle | Pages accessibles |
|------|------------------|
| `admin` | Toutes |
| `directeur` | Toutes sauf Finances, Utilisateurs et Paramètres |
| `gestionnaire` | Toutes sauf Utilisateurs, Paramètres et Audit |
| `agent de scolarité` | Dashboard, Élèves, Emploi du temps, Calendrier, Messagerie, Bibliothèque, Absences, Finances |
| `professeur` | Dashboard, Classes, Notes, Évaluations, Bulletins, Activités, Emploi du temps, Calendrier, Messagerie, Absences |
| `pointeur` | Dashboard, Emploi du temps, Calendrier, Messagerie, Absences, Pointage |

> Le journal d'audit (`/audit`) est réservé à la direction (admin, directeur) côté API.

### Bulletins — filières et types

| Type | Description |
|------|-------------|
| `FR` / `AR` | Bulletin d'une filière (français / arabe) |
| `EN` | Accepté par l'API (schémas) — la généralisation du service et des templates est en cours (Phase 3) |
| `COMBINE` | **Combiné au choix** : fusionne les filières choisies à la génération (`filieres_combine`, ex. FR+AR, FR+EN) ; repli sur les filières actives de l'élève |
| `ANNUEL` | Récapitulatif annuel des périodes (trimestres/semestres selon l'établissement) |

Points clés du calcul et du rendu :
- **Barème de saisie effectif** d'une matière : `ClasseMatierePeriode.note_max` > `ClasseMatiere.note_max_override` > `Matiere.note_max` > `ConfigNotes.note_max`. Les notes sont normalisées sur la base canonique de l'établissement avant le calcul des moyennes.
- **Échelle d'affichage** de la moyenne : portée par le **niveau** (`Niveau.note_max`, ex. primaire /10 et secondaire /20 dans le même établissement) ; repli sur `ConfigNotes.note_max`.
- **Mentions** : configurables par établissement, avec portée filière et/ou niveau (résolution : filière+niveau > filière > niveau > établissement).
- **Coefficients par période** : `ClasseMatierePeriode` permet de changer coefficient/barème/évaluée d'une matière entre le T1 et le T2 (fréquent en filière arabe).
- **Verrouillage de période** : un préflight contrôle l'état avant génération ; la direction peut déverrouiller une période.
- **Templates éditables** : un template HTML par type (FR/AR/COMBINE/ANNUEL), personnalisable par établissement, rendu par le moteur interne `microTemplate`.

### Jours de cours flexibles

Les jours actifs de la semaine sont configurables par établissement dans **Paramètres → Pédagogie**. L'emploi du temps n'affiche que les colonnes correspondant aux jours actifs. Un créneau sur un jour inactif est refusé par l'API.

---

## Identité graphique

Identité enracinée dans la culture du daara sénégalais : papier chaud,
encre brune profonde, accent latérite (terracotta).

### Palette

| Rôle             | Token CSS        | Hex       |
|------------------|------------------|-----------|
| Fond papier      | `--paper`        | `#FAF6EE` |
| Surface élevée   | `--card`         | `#FFFFFF` |
| Encre principale | `--ink`          | `#1B1812` |
| Encre secondaire | `--ink-2`        | `#4A4337` |
| Accent primaire  | `--terra`        | `#B85433` |
| Accent hover     | `--terra-deep`   | `#8C3E25` |
| Mention/honneur  | `--sahel`        | `#C8932B` |
| Cachet officiel  | `--indigo`       | `#2D3A6E` |

Dark mode : fond `#1B1812`, surface `#231F18`, encre `#F1ECE0`, accent
`#E8825F`.

### Typographie

| Famille                | Usage                                   |
|------------------------|-----------------------------------------|
| **Fraunces** 500–700   | Titres, chiffres clés (KPI), display    |
| **Instrument Sans** 400–700 | Interface, paragraphes, formulaires |
| **JetBrains Mono** 400–500  | Matricules, n° reçus, dates ISO     |
| **Noto Naskh Arabic** 400–700 | Contenus arabe (RTL)              |

### Logo

- **Monogramme** : disque terracotta `#B85433` + lettres « Dg » en
  Fraunces 700 blanc (`<LogoIcon />`) — usages : favicon, sidebar, avatars.
- **Mark complet** : planchette `lawh` (forme arquée + trois lignes
  d'écriture + monogramme « Dg ») (`<LogoMark />`) — usages : page de
  connexion, en-tête bulletin PDF, page 404, splash mobile.

---

## Installation

### Prérequis

- Node.js 20+
- PostgreSQL 15+

### 1. Cloner

```bash
git clone https://github.com/kriimoohh/DaaraGest.git
cd DaaraGest
```

### 2. Backend

```bash
cd backend
npm install

# Configurer l'environnement
cp .env.example .env   # puis éditer DATABASE_URL, JWT_SECRET et QR_SECRET

# Appliquer les migrations (CLI local, pas global)
./node_modules/.bin/prisma migrate deploy

# Injecter les données initiales (dev)
npm run db:seed

# Démarrer
npm run dev            # http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

> Les deux serveurs doivent tourner simultanément.

> **Production (Railway)** : `npm start` exécute `prisma migrate deploy` puis le
> seed idempotent `seed-prod.cjs` avant de lancer le serveur — les migrations
> sont donc appliquées automatiquement au déploiement.

---

## Variables d'environnement

Validées au démarrage par Zod (`src/config/env.ts`) — le serveur **refuse de démarrer** si une variable requise est absente ou invalide.

### `backend/.env`

| Variable | Description | Requis |
|----------|-------------|--------|
| `DATABASE_URL` | URL PostgreSQL (`postgresql://user:pass@host:5432/db`) | ✅ |
| `JWT_SECRET` | Clé secrète JWT — **min 32 caractères** | ✅ |
| `QR_SECRET` | Clé de signature HMAC des QR codes (cartes, pointage) — **min 32 caractères** | ✅ |
| `CORS_ORIGIN` | Origine(s) autorisée(s), séparées par des virgules | défaut `http://localhost:5173` |
| `COOKIE_DOMAIN` | Domaine du cookie httpOnly (ex: `.mon-ecole.sn`) | prod |
| `PORT` | Port du serveur | défaut `3000` |
| `JWT_EXPIRES_IN` | Durée des tokens d'accès | défaut `24h` |
| `NODE_ENV` | `development` · `production` · `test` | défaut `development` |
| `SENTRY_DSN` | DSN Sentry — si absent, Sentry est désactivé (no-op) | — |
| `SENTRY_TRACES_SAMPLE_RATE` | Taux d'échantillonnage des traces (0–1) | défaut `0` |
| `PUPPETEER_EXECUTABLE_PATH` | Chemin Chrome/Chromium pour la génération PDF | — |

### `frontend/.env`

| Variable | Description | Défaut |
|----------|-------------|--------|
| `VITE_API_URL` | URL du backend | `http://localhost:3000` |

---

## Comptes par défaut

**À changer immédiatement en production.**

| Identifiant | Mot de passe | Rôle | Seed |
|-------------|-------------|------|------|
| `admin` | `Admin123!` | Administrateur (changement de mot de passe forcé à la 1re connexion) | dev + prod |
| `directeur` | `Directeur123!` | Directeur | dev uniquement |
| `caissier` | `Caissier123!` | Agent de scolarité | dev uniquement |
| `prof.fall` / `prof.diallo` / `prof.ahmed` / `prof.ndiaye` | `Prof123!` | Professeur | dev uniquement |
| `pointeur` | `Pointeur123!` | Pointeur | dev uniquement |

> Le seed de production (`seed-prod.cjs`) ne crée que le compte `admin` et les référentiels (rôles, niveaux, fonctions…).

---

## Commandes disponibles

### Backend

```bash
npm run dev              # Serveur en mode watch (tsx)
npm run build            # prisma generate + compilation TypeScript
npm start                # Prod : migrate deploy + seed-prod + serveur compilé
npm test                 # Tests unitaires (Vitest, sans DB)
npm run test:integration # Tests d'intégration (*.itest.ts, nécessite Postgres)
npm run test:watch       # Tests en mode watch
npm run test:coverage    # Rapport de couverture de code
npm run lint             # ESLint
npm run format           # Prettier
npm run db:migrate       # prisma migrate dev
npm run db:seed          # Seed de développement
npm run db:cleanup       # Script de nettoyage de données
npm run db:check         # Vérification de cohérence des données
npm run db:studio        # Interface Prisma Studio
```

### Frontend

```bash
npm run dev            # Serveur Vite
npm run build          # Build de production
npm run preview        # Prévisualiser le build
npm test               # Tests UI (Vitest + Testing Library)
```

---

## API Reference

Préfixe : `/api/v1`. Toutes les routes requièrent `Authorization: Bearer <token>` (ou le cookie httpOnly), **sauf** : `/health`, `POST /auth/login`, `POST /auth/refresh`, `GET /portail-parent/acces/:token` (+ PDF bulletin), `POST /pointage/scan` et `GET /pointage/scans-jour` (protégés par signature HMAC des QR).

### Auth

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/auth/login` | Connexion · rate-limited 5 req/min · verrouillage de compte après échecs répétés |
| `POST` | `/auth/refresh` | Renouveler le token via refresh token · rate-limited 10 req/min |
| `POST` | `/auth/logout` | Déconnexion + révocation du refresh token |
| `GET` | `/auth/me` | Profil connecté |
| `PUT` | `/auth/change-password` | Changer le mot de passe |
| `PUT` | `/auth/profil` | Mettre à jour nom, langue, thème |
| `DELETE` | `/auth/sessions` | Révoquer toutes les sessions actives |

### Années scolaires

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/annees-scolaires` | Liste |
| `POST` | `/annees-scolaires` | Créer |
| `PUT` | `/annees-scolaires/:id` | Modifier |
| `PUT` | `/annees-scolaires/:id/activer` | Définir comme active |
| `DELETE` | `/annees-scolaires/:id` | Supprimer |

### Filières

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/filieres` | Liste des filières de l'établissement |
| `POST` | `/filieres` | Créer (gestion) |
| `PATCH` | `/filieres/:id` | Modifier |
| `DELETE` | `/filieres/:id` | Supprimer (garde exhaustive des données liées) |

### Niveaux

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/niveaux` | Liste (avec échelle d'affichage `note_max` et groupe de grille IEF) |
| `POST` | `/niveaux` | Créer |
| `PUT` | `/niveaux/:id` | Modifier |
| `DELETE` | `/niveaux/:id` | Supprimer |

### Domaines pédagogiques

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/domaines` | Liste |
| `POST` | `/domaines` | Créer (gestion) |
| `PUT` | `/domaines/:id` | Modifier |
| `DELETE` | `/domaines/:id` | Supprimer (admin) |

### Matières

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/matieres?filiere=` | Liste (filtrable par filière) |
| `POST` | `/matieres` | Créer |
| `PUT` | `/matieres/:id` | Modifier |
| `DELETE` | `/matieres/:id` | Désactiver |

### Mentions

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/mentions` | Liste |
| `POST` | `/mentions` | Créer (gestion) |
| `PATCH` | `/mentions/:id` | Modifier |
| `DELETE` | `/mentions/:id` | Supprimer (la mention système « Insuffisant » est protégée) |

### Tarifs

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/tarifs` | Catalogue des tarifs |
| `POST` | `/tarifs` | Créer (admin) |
| `PATCH` | `/tarifs/:id` | Modifier (admin) |
| `DELETE` | `/tarifs/:id` | Supprimer (admin) |

### Fonctions (personnel)

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/fonctions` | Liste des fonctions configurées |
| `POST` | `/fonctions` | Créer (gestion) |
| `PATCH` | `/fonctions/:id` | Modifier |
| `DELETE` | `/fonctions/:id` | Supprimer (fonctions par défaut protégées) |

### Classes

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/classes?annee_scolaire_id=` | Liste |
| `GET` | `/classes/:id` | Détail |
| `GET` | `/classes/:id/eleves` | Élèves de la classe |
| `POST` | `/classes` | Créer |
| `PUT` | `/classes/:id` | Modifier |
| `DELETE` | `/classes/:id` | Supprimer |
| `POST` | `/classes/:id/dupliquer` | Dupliquer (vers une autre filière) |
| `GET` | `/classes/:id/pdf-liste` | Liste de classe en PDF |
| `GET` | `/classes/pdf-toutes-classes` | Listes de toutes les classes en PDF |
| `GET` | `/classes/:id/matieres` | Matières de la classe (coeff/barème effectifs) |
| `POST` | `/classes/:id/matieres` | Rattacher une matière |
| `PUT` | `/classes/:id/matieres/:matiere_id` | Overrides classe (coeff, barème, évaluée) |
| `DELETE` | `/classes/:id/matieres/:matiere_id` | Détacher |
| `PUT` | `/classes/:id/matieres/:matiere_id/periode` | Override spécifique à une période |
| `DELETE` | `/classes/:id/matieres/:matiere_id/periode/:periode` | Retirer l'override de période |

### Élèves

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/eleves?page&search&classe_id&actif&limit` | Liste paginée |
| `GET` | `/eleves/:id` | Détail + parents + inscriptions |
| `GET` | `/eleves/:id/progression` | Progression de l'élève |
| `GET` | `/eleves/:id/qr` | QR code de la carte élève |
| `GET` | `/eleves/export-excel` | Export Excel |
| `POST` | `/eleves` | Créer (matricule auto `CODE-E-YY-NNN`) |
| `POST` | `/eleves/import` | Import CSV · body `{ rows[] }` · max 500 · retourne `{ created, errors[] }` |
| `POST` | `/eleves/bulk-inscrire` | Inscription en masse dans une classe |
| `POST` | `/eleves/bulk-desactiver` | Désactivation en masse (admin) |
| `POST` | `/eleves/bulk-supprimer` | **Suppression définitive** en masse (admin) |
| `PUT` | `/eleves/:id` | Modifier |
| `PATCH` | `/eleves/:id/toggle-actif` | Activer/désactiver |
| `PATCH` | `/eleves/:id/transferer` | Transfert de classe en cours d'année |
| `POST` | `/eleves/:id/inscrire` | Inscrire dans une classe (par filière) |
| `DELETE` | `/eleves/:id` | **Suppression définitive** (admin, cascade contrôlée) |

### Personnel

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/personnel?page&search&limit` | Liste paginée |
| `GET` | `/personnel/:id` | Détail |
| `POST` | `/personnel` | Créer (utilisateur + profil liés) |
| `PUT` | `/personnel/:id` | Modifier |
| `DELETE` | `/personnel/:id` | Désactiver (soft-delete) |
| `GET` | `/personnel/:id/affectations` | Affectations matière×classe |
| `POST` | `/personnel/:id/affectations` | Affecter à une classe/matière |
| `DELETE` | `/personnel/:id/affectations/:classe_id` | Retirer une affectation |

### Notes

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/notes?classe_id&matiere_id&periode&annee_scolaire_id` | Liste |
| `POST` | `/notes/bulk` | Upsert en masse (valide contre le barème effectif ; politique de saisie profs) |
| `POST` | `/notes/bulk-supprimer` | Suppression en masse |
| `GET` | `/notes/eleve/:eleve_id` | Notes d'un élève |

### Bulletins

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/bulletins?annee_scolaire_id&periode&filiere&eleve_id` | Liste |
| `POST` | `/bulletins/preflight` | Contrôles avant génération (matières sans notes, période verrouillée…) |
| `POST` | `/bulletins/generer` | Générer les bulletins d'une période (FR · AR · EN · COMBINE, `filieres_combine` au choix) |
| `POST` | `/bulletins/generer-annuel` | Générer l'annuel (periode=0) |
| `POST` | `/bulletins/deverrouiller-periode` | Déverrouiller une période (direction) |
| `GET` | `/bulletins/:id` | Détail avec notes par filière |
| `PATCH` | `/bulletins/:id/observation` | Saisir l'observation du conseil/professeur |
| `GET` | `/bulletins/:id/pdf` | PDF individuel (Puppeteer) |
| `GET` | `/bulletins/pdf-classe?classe_id&periode&filiere` | PDF toute une classe |
| `GET` | `/bulletins/template/:type` | Template du bulletin (personnalisé ou défaut) |
| `PUT` | `/bulletins/template/:type` | Créer/modifier le template (direction) |
| `POST` | `/bulletins/template/:type/apercu` | Aperçu HTML du template |
| `DELETE` | `/bulletins/template/:type/reset` | Réinitialiser au template par défaut (direction) |

### Absences élèves

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/absences?classe_id&date&eleve_id&page` | Liste paginée |
| `GET` | `/absences/jour` | Absences du jour par classe |
| `GET` | `/absences/stats` | Statistiques |
| `GET` | `/absences/eleve/:id` | Absences d'un élève |
| `POST` | `/absences` | Saisie individuelle |
| `POST` | `/absences/bulk` | Saisie groupée (déclenche alerte si ≥ seuil) |

### Emploi du temps

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/emploi-du-temps?classe_id&annee_scolaire_id` | Créneaux par classe |
| `POST` | `/emploi-du-temps` | Créer un créneau (valide jour actif + conflits) |
| `PUT` | `/emploi-du-temps/:id` | Modifier |
| `DELETE` | `/emploi-du-temps/:id` | Supprimer |

### Calendrier scolaire

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/calendrier?annee_scolaire_id&mois&annee` | Événements |
| `POST` | `/calendrier` | Créer un événement |
| `PUT` | `/calendrier/:id` | Modifier |
| `DELETE` | `/calendrier/:id` | Supprimer |

### Notifications

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/notifications` | Notifications non lues de l'utilisateur courant |
| `PUT` | `/notifications/:id/lue` | Marquer une notification comme lue |
| `PUT` | `/notifications/lire-toutes` | Marquer toutes comme lues |

### Messagerie

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/messagerie` | Liste des conversations + indicateur non-lus |
| `POST` | `/messagerie` | Créer une conversation (individuelle ou broadcast par rôle) |
| `GET` | `/messagerie/utilisateurs` | Destinataires possibles |
| `GET` | `/messagerie/:id` | Messages d'une conversation (marque comme lue) |
| `POST` | `/messagerie/:id/messages` | Envoyer un message |

### Portail parent

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `GET` | `/portail-parent/acces/:token` | **Public** (30 req/min) | Données complètes de l'élève (notes, paiements, absences) |
| `GET` | `/portail-parent/acces/:token/bulletin/:bulletin_id/pdf` | **Public** (10 req/min) | Bulletin PDF de l'élève |
| `POST` | `/portail-parent/generer` | JWT | Générer/renouveler le lien de portail d'un élève |
| `DELETE` | `/portail-parent/:token/revoquer` | JWT | Révoquer un lien |
| `GET` | `/portail-parent` | JWT | Lister les tokens actifs de l'établissement |

### Finances

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/finances/stats` | Stats du mois courant |
| `GET` | `/finances/stats-mensuels?nb_mois=6` | Encaissements des N derniers mois |
| `GET` | `/finances/paiements-eleves?page&search&type&statut&mois&annee` | Liste paginée |
| `POST` | `/finances/paiements-eleves` | Créer (numéro de reçu auto `REC-YYYYMMDD-XXXXX`) |
| `POST` | `/finances/paiements-eleves/bulk` | Saisie en masse |
| `PUT` | `/finances/paiements-eleves/:id` | Modifier |
| `DELETE` | `/finances/paiements-eleves/:id` | Supprimer |
| `GET` | `/finances/paiements-personnel?page&mois&annee` | Paiements du personnel (alias legacy : `/paiements-professeurs`) |
| `POST` | `/finances/paiements-personnel` | Créer |
| `GET` | `/finances/reliquats?mois&annee&annee_scolaire_id` | Élèves sans mensualité pour la période |
| `GET` | `/finances/export-excel` · `/export-pdf` | Exports des paiements |
| `GET` | `/finances/reliquats/export-excel` · `/reliquats/export-pdf` | Exports des reliquats |

### Pointage

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/pointage/jour?date=YYYY-MM-DD` | Personnel actif + présence du jour |
| `POST` | `/pointage/bulk` | Saisie groupée d'une journée |
| `POST` | `/pointage` | Upsert individuel |
| `GET` | `/pointage?mois&annee&statut&professeur_id&page` | Historique paginé |
| `GET` | `/pointage/stats?mois&annee` | Stats par personnel (taux de présence) |
| `GET` | `/pointage/qr/:personnelId` | QR code signé du personnel (direction) |
| `POST` | `/pointage/qr/:personnelId/regenerer` | Régénérer le QR (révoque l'ancien) |
| `POST` | `/pointage/scan` | **Public** — scan d'un QR signé HMAC → pointage `source='qr'` |
| `GET` | `/pointage/scans-jour` | **Public** — scans du jour (page scanner) |

### Demandes d'absence personnel

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/demandes-absence-personnel` | Liste (gestion) |
| `POST` | `/demandes-absence-personnel` | Créer une demande |
| `PATCH` | `/demandes-absence-personnel/:id/traiter` | Approuver/refuser |
| `DELETE` | `/demandes-absence-personnel/:id` | Supprimer |

### Évaluations formatives

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/evaluations?classe_id&matiere_id&periode&annee_scolaire_id` | Liste |
| `POST` | `/evaluations` | Créer une évaluation |
| `PUT` | `/evaluations/:id` | Modifier |
| `DELETE` | `/evaluations/:id` | Supprimer (direction) |
| `GET` | `/evaluations/moyenne?classe_id&matiere_id&periode` | Moyenne pondérée |
| `GET` | `/evaluations/:id/notes` | Notes d'une évaluation |
| `POST` | `/evaluations/:id/notes/bulk` | Saisie en masse des notes |

### Activités parascolaires

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/activites` | Liste des activités |
| `POST` | `/activites` | Créer une activité |
| `PUT` | `/activites/:id` | Modifier |
| `DELETE` | `/activites/:id` | Supprimer (direction) |
| `GET` | `/activites/:id/inscriptions` | Élèves inscrits |
| `POST` | `/activites/:id/inscriptions` | Inscrire un élève |
| `DELETE` | `/activites/:id/inscriptions/:eleve_id` | Désinscrire |
| `GET` | `/activites/:id/seances` | Séances de l'activité |
| `POST` | `/activites/:id/seances` | Créer une séance |
| `DELETE` | `/activites/:id/seances/:seance_id` | Supprimer une séance |
| `GET` | `/activites/:id/seances/:seance_id/presences` | Présences à une séance |
| `POST` | `/activites/:id/seances/:seance_id/presences/bulk` | Saisie présences en masse |
| `POST` | `/activites/inscriptions/:inscription_id/evaluation` | Évaluer un élève |

### Progression pluriannuelle

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/progression` | Liste des progressions |
| `POST` | `/progression/generer` | Générer / mettre à jour les progressions |
| `PUT` | `/progression/:id/valider` | Valider une progression (direction) |
| `GET` | `/progression/eleve/:eleve_id/historique` | Historique académique d'un élève |

### Documents officiels

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/documents` | Lister les templates disponibles (25 types) |
| `GET` | `/documents/historique?skip&take` | Historique des documents générés |
| `POST` | `/documents/generer` | Générer un document PDF |
| `POST` | `/documents/generer-lot` | Générer un lot de cartes PDF (CARTE_ELEVE · CARTE_PROFESSEUR) |
| `POST` | `/documents/apercu` | Aperçu HTML d'une carte (sans PDF ni historique) |
| `GET` | `/documents/:type` | Récupérer un template (personnalisé ou défaut) |
| `PUT` | `/documents/:type` | Créer ou modifier un template personnalisé (direction) |
| `DELETE` | `/documents/:type/reset` | Réinitialiser au template par défaut (direction) |

### Statistiques analytiques

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/stats/tableau-de-bord` | KPIs direction : présences, moyennes, top/bottom élèves, alertes actives |

### Rapports

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/rapports/presences-eleves?classe_id&periode&annee_scolaire_id` | Rapport présences élèves |
| `GET` | `/rapports/presences-personnel` | Rapport présences personnel (alias legacy : `/presences-professeurs`) |
| `GET` | `/rapports/resultats-classe?classe_id&periode&annee_scolaire_id` | Résultats par classe |
| `GET` | `/rapports/bilan-financier?mois&annee` | Bilan financier (direction) |
| `GET` | `/rapports/grille-ief` | Grille officielle IEF |
| `GET` | `/rapports/grille-performance` | Grille de performance |
| `GET` | `/rapports/performance-domaine` | Performance par domaine pédagogique |
| `GET` | `/rapports/releve-notes` | Relevé de notes |
| `GET` | `/rapports/propositions-fin` | Propositions de fin d'année |
| `GET` | `/rapports/charges-personnel` | Charges du personnel |
| `GET` | `/rapports/apercu/*` | Aperçu HTML de chacun des rapports ci-dessus |

### Audit

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/audit` | Journal d'audit filtrable (direction) |
| `GET` | `/audit/entites` | Types d'entités présents dans le journal |

### Bibliothèque

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/bibliotheque/livres` | Catalogue des livres |
| `POST` | `/bibliotheque/livres` | Ajouter un livre |
| `PUT` | `/bibliotheque/livres/:id` | Modifier un livre |
| `DELETE` | `/bibliotheque/livres/:id` | Supprimer (admin/directeur) |
| `GET` | `/bibliotheque/emprunts` | Liste des emprunts |
| `POST` | `/bibliotheque/emprunts` | Créer un emprunt |
| `PUT` | `/bibliotheque/emprunts/:id/retour` | Enregistrer un retour |
| `GET` | `/bibliotheque/emprunts/en-retard` | Emprunts en retard |

### Paramètres

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/parametres` | Établissement + config notes (admin) |
| `PUT` | `/parametres` | Modifier l'établissement |
| `GET` | `/parametres/notes` | Config notes (échelle, périodes, seuils, `jours_cours`, rendu bulletins…) |
| `PUT` | `/parametres/notes` | Modifier la config |
| `GET` | `/parametres/notes/politique` | Politique de saisie des notes applicable à l'utilisateur courant |
| `GET` | `/parametres/notifications` | Préférences de notifications de l'établissement |
| `PUT` | `/parametres/notifications` | Modifier les préférences |

### Utilisateurs

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/utilisateurs/roles` | Liste des rôles (depuis la DB) |
| `GET` | `/utilisateurs?page&search&role` | Liste paginée |
| `POST` | `/utilisateurs` | Créer |
| `PUT` | `/utilisateurs/:id` | Modifier |
| `DELETE` | `/utilisateurs/:id` | Désactiver |
| `PUT` | `/utilisateurs/:id/reactiver` | Réactiver |
| `DELETE` | `/utilisateurs/:id/definitif` | Suppression définitive |
| `PUT` | `/utilisateurs/:id/reset-password` | Réinitialiser le mot de passe |

---

## Modules

### Workflow typique en début d'année

1. **Paramètres** — Vérifier l'établissement (code matricule, devise), les filières actives, les tarifs, les jours de cours et la config des notes (nombre et noms des périodes : trimestres ou semestres)
2. **Années scolaires** — Créer l'année (ex: "2025-2026") et l'activer
3. **Niveaux & Domaines** — Vérifier les niveaux (échelle d'affichage, grille IEF) et les domaines pédagogiques
4. **Matières** — Vérifier/ajouter les matières par filière avec coefficients et barèmes
5. **Classes** — Créer les classes, rattacher les matières (overrides par classe/période si besoin)
6. **Élèves** — Ajouter manuellement ou **importer via CSV** (matricule auto `CODE-E-YY-NNN`), inscrire dans les classes par filière
7. **Personnel** — Créer les comptes du personnel et les affectations matière×classe
8. **Emploi du temps** — Saisir les créneaux par classe
9. **Calendrier scolaire** — Enregistrer les vacances et examens
10. **Notes → Bulletins → Finances → Pointage** au fil de l'année

### Import CSV élèves

Format attendu (en-têtes obligatoires : `nom_fr`, `prenom_fr`, `sexe`) :

```csv
nom_fr,prenom_fr,nom_ar,prenom_ar,date_naissance,sexe,parent_nom_fr,parent_lien,parent_telephone
FALL,Amadou,فال,أمادو,2010-05-15,M,FALL Moussa,père,771234567
DIALLO,Fatou,ديالو,فاتو,2011-09-20,F,DIALLO Ibrahima,père,775678901
```

- `sexe` : M ou F
- `parent_lien` : pere · mere · tuteur
- `date_naissance` : YYYY-MM-DD
- Maximum 500 lignes par import
- Les lignes invalides sont ignorées avec rapport d'erreur détaillé

### Pointage par QR code

1. Chaque personnel dispose d'un **QR code signé HMAC** (`QR_SECRET`), affiché sur sa carte professionnelle (module Documents) ou récupérable dans Pointage
2. La page publique **`/scanner`** (tablette/téléphone à l'entrée) scanne les QR via la caméra
3. Un scan valide crée/complète la présence du jour (`source='qr'`) — arrivée puis départ
4. Un QR peut être **régénéré** à tout moment (l'ancien est invalidé)
5. Le pointage manuel reste disponible pour les correctifs et les statuts congé/retard

### Portail parents

Le portail parent est accessible via un lien unique sans création de compte :

1. Page **Élèves** → cliquer l'icône portail sur la ligne de l'élève
2. Cliquer **Générer le lien** → un UUID est créé (ou renouvelé)
3. Copier et partager le lien via WhatsApp ou SMS
4. Le parent voit les **notes par période**, **paiements**, **absences**, **informations de l'élève** et peut **télécharger les bulletins PDF**
5. L'admin peut révoquer un lien à tout moment

### Messagerie interne

- **Individuelle** : envoyer à un ou plusieurs utilisateurs nommément
- **Broadcast** : envoyer à un ou plusieurs rôles (ex: tous les professeurs)
- Messages classés du plus ancien au plus récent dans le fil
- Indicateur non-lus sur la liste de conversations
- Raccourci **Ctrl+Enter** pour envoyer

### Alertes automatiques (notifications)

| Déclencheur | Destinataires |
|-------------|---------------|
| Élève atteint N × `seuil_absences_alerte` absences non-justifiées | admin, directeur, gestionnaire |
| Professeur marqué absent | admin, directeur |

---

## Sécurité

| Mesure | Détail |
|--------|--------|
| Variables d'env | Validées par Zod au boot (`config/env.ts`) — **fail-fast** si `JWT_SECRET`/`QR_SECRET` absents ou < 32 caractères |
| JWT | HMAC-SHA256, expiration 24h (configurable), refresh tokens révocables |
| Transport du token | `Authorization: Bearer <token>` + cookie httpOnly `daaragest_token` en fallback |
| Stockage token (frontend) | Zustand + `localStorage` (compromis UX/sécurité — acceptable pour outil interne) |
| Mots de passe | bcrypt cost 10 · changement forcé à la 1re connexion (seed) |
| Verrouillage de compte | Compteur de tentatives + verrouillage temporaire après échecs répétés |
| Auth middleware | `return reply.status(401)` — arrêt immédiat sur token invalide |
| Rate limiting | Global : **1000 req/15 min par utilisateur** (clé = hash du JWT ; repli sur l'IP pour les routes publiques — l'école entière partage une seule IP publique via NAT) · login 5/min · refresh 10/min · portail parent 30/min |
| CSRF | Validation de l'en-tête `Origin` sur toutes les mutations (POST/PUT/PATCH/DELETE) — indispensable car l'auth cookie est `sameSite=none` en prod |
| CORS | Origines configurables via `CORS_ORIGIN` (multi, séparées par virgules) |
| Headers HTTP | `Content-Security-Policy` (report-only en dev), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `HSTS` (prod) |
| Logs | Redaction automatique des mots de passe, cookies et en-têtes `Authorization` |
| Multi-tenant | Chaque requête filtre par `etablissement_id` extrait du JWT |
| Validation | Zod sur tous les body POST/PUT · `z.coerce.number()` pour les Decimal Prisma |
| PDF | `escapeHtml()` sur toutes les données utilisateur avant insertion dans les templates |
| QR codes | Signés HMAC-SHA256 (`QR_SECRET`) — un QR forgé est rejeté au scan |
| Portail parent | Token UUID en base, révocable, sans création de compte utilisateur |
| Erreurs | Gestionnaire global : 4xx explicites, 5xx anonymisés + capture Sentry |
| Proxy | `trustProxy` activé (Railway) pour que le rate-limit voie la vraie IP cliente |

### Flux d'authentification

```
1. POST /auth/login → { user, token } + cookie httpOnly + refresh token
2. Frontend stocke le token dans Zustand (localStorage)
3. Chaque requête : Authorization: Bearer <token> (ou cookie)
4. Backend : jwtVerify() → vérifie header puis cookie en fallback
5. Zod valide le payload JWT (id, role, etablissement_id, langue, theme, doit_changer_mdp)
6. À expiration : POST /auth/refresh renouvelle silencieusement le token
```

### Configuration production

```bash
JWT_SECRET=<64+ caractères aléatoires>
QR_SECRET=<64+ caractères aléatoires>
CORS_ORIGIN=https://votre-domaine.com
NODE_ENV=production
SENTRY_DSN=<optionnel>
```

> ⚠️ Changer le mot de passe admin `Admin123!` dès la première connexion (le changement est forcé par l'application).

---

## Tests & CI

Trois familles de tests :

| Famille | Volume | Commande | DB requise |
|---------|--------|----------|------------|
| Unitaires backend | ~550 cas · 20 fichiers `*.test.ts` | `npm test` (backend) | Non |
| Intégration backend | 3 fichiers `*.itest.ts` (audit, bulletins, suppression élève) | `npm run test:integration` | **Oui (Postgres)** |
| UI frontend | Composants (Button, Badge, Pagination) — Testing Library | `npm test` (frontend) | Non |

Principaux domaines couverts côté unitaire : calculs de bulletins (moyennes pondérées, mentions, classement, template), pointage (`calcHeures`), matricules, reçus, validation des notes et barèmes, alertes d'absence, auth (hash, payload JWT, lockout), CSRF, documents/templates, RBAC de tous les groupes, sécurité (injection, escapeHtml), politique de saisie des notes, filières, micro-templating.

### CI (GitHub Actions)

À chaque push/PR (`.github/workflows/ci.yml`) :

1. **Backend** — `prisma generate`, type-check, ESLint, tests unitaires, build
2. **Intégration** — Postgres 16 en service, **replay complet des migrations depuis zéro** (`prisma migrate deploy`), puis tests d'intégration
3. **Frontend** — type-check, tests, build Vite

> ⚠️ `npm test` local ne couvre pas les tests d'intégration : lancer `npm run lint` **et** `npm run test:integration` avant de pousser un changement de schéma ou de lecteurs.

---

## Roadmap — chantiers en cours

> **Modules déjà implémentés** : Filières génériques (entité + inscriptions N-filières), Mentions configurables, Échelle d'affichage par niveau, Domaines & grilles IEF, Tarifs, Fonctions configurables, Pointage QR, Audit log, Demandes d'absence personnel, Évaluations formatives, Progression pluriannuelle, Activités parascolaires, Bibliothèque, Portail parents (+ bulletins PDF), Documents officiels (25 types), Rapports (11 types + aperçus), Tableau de bord analytique, Refresh tokens, Verrouillage de période des bulletins, Templates de bulletins éditables, i18n EN, Sentry, CI complète.

### Refonte filières — Phase 2c (destructive)

La colonne string `filiere` (Matiere, Classe, Bulletin) reste la source de vérité pendant la transition ; `filiere_id` est backfillée en parallèle. La Phase 2c basculera les lecteurs sur `filiere_id` et retirera les colonnes string.

### Bulletins EN — Phase 3

L'API accepte déjà `EN` (schémas Zod, génération générique par cohorte) mais des portions du service restent câblées FR/AR (préflight, libellés d'appréciation, template éditable limité à FR/AR/COMBINE/ANNUEL). Généralisation en cours.

### i18n

L'anglais est une **langue d'interface** (fr/ar/en, fallback fr) distincte de la filière EN. Le socle est traduit ; la traduction arabe est à compléter section par section (~1 630 lignes sur 1 816).

### Pointage NFC

Les modèles `PersonnelCarte`, `Pointage` et `HeureTravail` sont présents en schéma mais sans API. Le pointage QR couvre le besoin actuel ; le NFC reste une évolution possible (badges physiques).

### Application mobile (React Native)

Expo + partage des types TypeScript, mode hors-ligne pour la saisie de notes et la messagerie.

### Priorités suggérées

| Chantier | Valeur métier | Complexité |
|----------|--------------|------------|
| Phase 2c filières (retrait colonnes string) | ★★★☆☆ | ★★★☆☆ |
| Bulletins EN (Phase 3) | ★★★☆☆ | ★★★☆☆ |
| Complétion i18n AR | ★★★☆☆ | ★★☆☆☆ |
| Pointage NFC | ★★☆☆☆ | ★★★★☆ |
| App mobile | ★★★★★ | ★★★★★ |

---

## Dette technique

Points connus à traiter lors d'une prochaine session de dev planifiée. L'application est **pleinement fonctionnelle** en l'état.

### 1. Transition filières inachevée *(priorité haute — chantier actif)*

Double source de vérité temporaire : `filiere` (string) et `filiere_id` (FK) coexistent sur `Matiere`, `Classe` et `Bulletin`. À résorber en Phase 2c (voir roadmap).

### 2. Doublon seuils de mentions *(priorité moyenne)*

`ConfigNotes.seuil_tres_bien/bien/assez_bien/passable` coexistent avec la table `Mention` qui les remplace. À retirer une fois tous les lecteurs basculés sur `Mention`.

### 3. Page Audit sans entrée de menu *(priorité basse)*

La route `/audit` existe côté frontend mais aucun lien de navigation n'y mène (accessible uniquement par URL directe). Ajouter l'entrée Sidebar pour la direction.

### 4. Champs deprecated `Etablissement` *(priorité basse)*

`nom_directeur` / `civilite_directeur` sont conservés pour rétro-compatibilité tant que tous les établissements n'ont pas un `directeur_id` (Personnel). À supprimer par migration.

### 5. Modèles NFC sans API *(priorité basse)*

`PersonnelCarte`, `Pointage`, `HeureTravail` sont en schéma sans aucune route. À implémenter (roadmap NFC) ou à retirer.

### 6. Token JWT en localStorage *(priorité basse)*

Le transport cross-subdomain bloque les cookies cross-origin, ce qui a nécessité le stockage en `localStorage`. Alternative propre : mettre frontend et API sur le même domaine (ex: `ecole.sn` + `ecole.sn/api`) avec un proxy nginx, puis le cookie httpOnly peut être la seule solution de transport.
