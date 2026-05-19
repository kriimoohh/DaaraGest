# DaaraGest

Application web de gestion d'école franco-arabe, conçue pour les établissements scolaires au Sénégal. Gestion complète des élèves, professeurs, classes, notes, bulletins, finances, pointage, emploi du temps, messagerie interne, bibliothèque et portail parents — avec interface bilingue Français/Arabe et une landing page publique présentant la plateforme.

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
- [Tests](#tests)
- [Roadmap — Phases à venir](#roadmap--phases-à-venir)
- [Dette technique](#dette-technique)

---

## Fonctionnalités

### Fonctionnalités actuelles (v2)

| Module | Description |
|--------|-------------|
| **Landing page** | Page d'accueil publique présentant la plateforme, ses modules et les guides par rôle — bilingue FR/AR avec basculement thème |
| **Élèves** | Inscription, fiche complète, matricule auto-généré `DG-YYYY-NNN`, import en masse via CSV |
| **Professeurs** | Comptes liés à un utilisateur, spécialités, type de contrat, salaire de base |
| **Classes** | Deux filières (Française / Arabe), niveaux, capacité, par année scolaire |
| **Matières** | Coefficients, note max/min configurables par matière |
| **Notes** | Saisie en masse par classe/matière/période, tri alphabétique, validation par matière |
| **Évaluations** | Évaluations formatives (devoir, contrôle, examen) avec pondération |
| **Bulletins** | 4 types (FR · AR · Combiné · Annuel), moyennes pondérées, classement, export PDF individuel ou classe entière |
| **Progression** | Suivi de la progression académique des élèves par période et par classe |
| **Activités** | Activités parascolaires et projets pédagogiques par classe |
| **Absences élèves** | Saisie par classe, justification, alertes automatiques au-delà du seuil configurable |
| **Pointage** | Saisie journalière présence/absence/retard/congé des professeurs, durée auto, historique, statistiques |
| **Emploi du temps** | Créneaux horaires par classe/professeur/matière, jours actifs flexibles par établissement, détection de conflits |
| **Calendrier scolaire** | Événements (vacances, examens, réunions, fermetures), navigation mensuelle, vue liste |
| **Notifications in-app** | Cloche avec badge, alertes d'absence, absences professeurs, refresh auto toutes les 60s |
| **Messagerie interne** | Conversations filées, tout-à-tout + broadcast par rôle, raccourci Ctrl+Enter |
| **Portail parents** | Page publique sans compte (lien UUID), notes, paiements, absences, informations de l'élève |
| **Bibliothèque** | Catalogue des livres, gestion des prêts/retours, suivi du stock |
| **Finances** | Paiements élèves (mensualités, inscriptions), reliquats, paiements professeurs, numéros de reçu auto |
| **Documents officiels** | Génération de certificats de scolarité, attestations et documents PDF à partir de templates |
| **Rapports** | Rapports synthétiques par classe, période, module |
| **Utilisateurs** | Rôles depuis la DB, réinitialisation de mot de passe |
| **Paramètres** | Établissement, barème des notes, niveaux, tarifs, préférences de notifications, sécurité du compte |
| **Dashboard** | Statistiques clés, graphique des encaissements sur 6 mois (Recharts) |
| **i18n FR/AR** | Interface complète bilingue avec basculement RTL instantané |
| **Dark mode** | Persistant par utilisateur, actif dès la page de connexion |

---

## Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Backend | Node.js + Fastify | 4.x |
| ORM | Prisma | 5.x |
| Base de données | PostgreSQL | 15+ |
| Authentification | @fastify/jwt v7 + @fastify/cookie v7 + bcryptjs | cost 10 |
| Rate limiting | @fastify/rate-limit | 9.x |
| Validation | Zod (avec coerce pour les Decimal Prisma) | 3.x |
| PDF | Puppeteer | 24.x |
| Tests | Vitest + @vitest/coverage-v8 | 4.x |
| Frontend | React 18 + Vite | — |
| Styles | Tailwind CSS (darkMode: class) | — |
| État global | Zustand + persist | — |
| i18n | i18next + react-i18next | — |
| Graphiques | Recharts | — |
| Import CSV | PapaParse | — |
| Routing | react-router-dom v6 (flags v7 activés) | — |

> **Note versions** : `@fastify/jwt` et `@fastify/cookie` sont maintenus en v7.x (compatibles Fastify 4). Les versions v8+/v11+ requièrent Fastify 5 — voir section [Dette technique](#dette-technique).

> **Note CLI Prisma** : le CLI global peut être en v7.x alors que le projet utilise Prisma v5. Toujours utiliser `./node_modules/.bin/prisma generate` dans ce projet pour éviter les conflits de version.

---

## Architecture

```
DaaraGest/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # 31 modèles, multi-tenant etablissement_id
│   │   └── seed.ts              # École Franco Arabe Cheikh Abdoul Ahad Mbacké
│   └── src/
│       ├── config/
│       │   └── roles.ts         # ROLE_GROUPS (DIRECTION, GESTION, ACADEMIQUE…)
│       ├── middlewares/         # authMiddleware (return sur 401)
│       ├── modules/             # 19 modules
│       │   ├── auth/            # login, me
│       │   ├── annees-scolaires/
│       │   ├── classes/
│       │   ├── eleves/          # + import CSV bulk
│       │   ├── matieres/
│       │   ├── niveaux/
│       │   ├── notes/           # bulk upsert
│       │   ├── bulletins/       # 4 types + PDF Puppeteer
│       │   ├── absences/        # absences élèves + alertes
│       │   ├── finances/        # paiements + reliquats + stats mensuelles
│       │   ├── parametres/      # établissement + configNotes + jours_cours
│       │   ├── pointage/        # présences manuelles + alertes
│       │   ├── professeurs/
│       │   ├── utilisateurs/    # + GET /roles
│       │   ├── emploi-du-temps/ # créneaux, conflits, jours actifs
│       │   ├── calendrier/      # événements scolaires
│       │   ├── notifications/   # in-app, marquer lue(s)
│       │   ├── messagerie/      # conversations, messages, broadcast
│       │   └── portail-parent/  # tokens UUID, accès public
│       └── server.ts            # Fastify + CORS configurable + JWT fail-fast
│
└── frontend/
    └── src/
        ├── components/
        │   ├── layout/          # Sidebar (role-based), Layout
        │   └── ui/              # Button, Badge, Table, Modal, Input, Select,
        │                        #   SearchInput, Pagination, ConfirmModal, PageHeader,
        │                        #   ProtectedRoute, NotificationBell
        ├── hooks/               # useApi, useAuth, useTheme
        ├── i18n/fr/ + i18n/ar/  # 130+ clés de traduction
        ├── pages/               # 17 pages (+ Dashboard + Login + PortailParent)
        ├── lib/api.ts           # fetch wrapper
        └── store/               # authStore (Zustand + persist)
```

### Modèles Prisma (31)

**Établissement & Utilisateurs**
`Etablissement` · `Role` · `Utilisateur`

**Personnels**
`Professeur` · `ProfesseurCarte` · `Pointage` · `HeureTravail` · `PresenceProfesseur` · `PaiementProfesseur`

**Académique**
`AnneeScolaire` · `ConfigNotes` · `Matiere` · `Niveau` · `Classe` · `ClasseMatiere` · `ProfMatiereClasse`

**Élèves**
`Eleve` · `Parent` · `Inscription` · `PaiementEleve` · `Note` · `Bulletin` · `AbsenceEleve` · `AuditLog`

**Phase 1 — Planification & Communication**
`Creneau` · `EvenementCalendrier` · `Notification`

**Phase 2 — Messagerie & Portail**
`Conversation` · `ConversationParticipant` · `MessageConversation` · `PortailParentToken`

### Isolation multi-établissements

Chaque requête authentifiée extrait `etablissement_id` du JWT. Tous les services filtrent par cet identifiant — aucune donnée d'un autre établissement n'est accessible.

### Rôles et accès

| Rôle | Pages accessibles |
|------|------------------|
| `admin` | Toutes |
| `directeur` | Toutes sauf Utilisateurs et Paramètres |
| `gestionnaire` | Dashboard, Élèves, Professeurs, Classes, Années, Matières, Notes, Bulletins, Absences, Emploi du temps, Calendrier, Messagerie, Pointage |
| `agent de scolarité` | Dashboard, Élèves, Classes, Notes, Bulletins, Absences, Finances, Emploi du temps, Calendrier, Messagerie |
| `professeur` | Dashboard, Classes, Notes, Bulletins, Absences, Emploi du temps, Calendrier, Messagerie |
| `pointeur` | Dashboard, Absences, Pointage, Emploi du temps, Calendrier, Messagerie |

### Bulletins — filières et types

| Type | Description |
|------|-------------|
| `FR` | Bulletin filière française uniquement |
| `AR` | Bulletin filière arabe uniquement |
| `COMBINE` | Bulletins FR et AR fusionnés — la moyenne couvre les deux filières |
| `ANNUEL` | Récapitulatif annuel des trois trimestres |

> Un élève inscrit dans une classe FR **et** une classe AR peut recevoir un bulletin `COMBINE`.

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
cp .env.example .env   # puis éditer DATABASE_URL et JWT_SECRET

# Créer les tables
./node_modules/.bin/prisma db push   # utiliser le CLI local, pas global

# Injecter les données initiales
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

---

## Variables d'environnement

### `backend/.env`

| Variable | Description | Requis |
|----------|-------------|--------|
| `DATABASE_URL` | URL PostgreSQL (`postgresql://user:pass@host:5432/db`) | ✅ |
| `JWT_SECRET` | Clé secrète JWT — le serveur **refuse de démarrer** si absente | ✅ |
| `CORS_ORIGIN` | Origine autorisée (ex: `https://mon-ecole.sn`) | ✅ prod |
| `PORT` | Port du serveur | défaut `3000` |
| `JWT_EXPIRES_IN` | Durée des tokens | défaut `7d` |
| `NODE_ENV` | `development` ou `production` | — |

### `frontend/.env`

| Variable | Description | Défaut |
|----------|-------------|--------|
| `VITE_API_URL` | URL du backend | `http://localhost:3000` |

---

## Comptes par défaut

Générés par le seed. **À changer immédiatement en production.**

| Identifiant | Mot de passe | Rôle |
|-------------|-------------|------|
| `admin` | `Admin123!` | Administrateur |

---

## Commandes disponibles

### Backend

```bash
npm run dev            # Serveur en mode watch (tsx)
npm run build          # Compilation TypeScript
npm start              # Démarrer le build compilé
npm test               # Tests unitaires (Vitest)
npm run test:watch     # Tests en mode watch
npm run test:coverage  # Rapport de couverture de code
npm run db:seed        # Injecter les données initiales
npm run db:studio      # Interface Prisma Studio
```

### Frontend

```bash
npm run dev            # Serveur Vite
npm run build          # Build de production
npm run preview        # Prévisualiser le build
```

---

## API Reference

Toutes les routes (sauf `/health`, `POST /api/v1/auth/login`, et `GET /api/v1/portail-parent/acces/:token`) requièrent `Authorization: Bearer <token>`.

### Auth

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/v1/auth/login` | Connexion · rate-limited 5 req/min · retourne `{ token, user }` |
| `GET` | `/api/v1/auth/me` | Profil connecté |

### Années scolaires

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/annees-scolaires` | Liste |
| `POST` | `/api/v1/annees-scolaires` | Créer |
| `PUT` | `/api/v1/annees-scolaires/:id` | Modifier |
| `PUT` | `/api/v1/annees-scolaires/:id/activer` | Définir comme active |
| `DELETE` | `/api/v1/annees-scolaires/:id` | Supprimer |

### Matières

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/matieres?filiere=FR\|AR` | Liste |
| `POST` | `/api/v1/matieres` | Créer |
| `PUT` | `/api/v1/matieres/:id` | Modifier |
| `DELETE` | `/api/v1/matieres/:id` | Désactiver |

### Classes

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/classes?annee_scolaire_id=` | Liste |
| `GET` | `/api/v1/classes/:id` | Détail |
| `POST` | `/api/v1/classes` | Créer |
| `PUT` | `/api/v1/classes/:id` | Modifier |
| `DELETE` | `/api/v1/classes/:id` | Supprimer |

### Élèves

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/eleves?page&search&classe_id&actif&limit` | Liste paginée |
| `GET` | `/api/v1/eleves/:id` | Détail + parents + inscriptions |
| `POST` | `/api/v1/eleves` | Créer (matricule auto si absent) |
| `PUT` | `/api/v1/eleves/:id` | Modifier |
| `DELETE` | `/api/v1/eleves/:id` | Désactiver |
| `POST` | `/api/v1/eleves/:id/inscrire` | Inscrire dans une classe |
| `POST` | `/api/v1/eleves/import` | Import CSV · body `{ rows[] }` · max 500 · retourne `{ created, errors[] }` |

### Professeurs

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/professeurs?page&search&limit` | Liste paginée |
| `GET` | `/api/v1/professeurs/:id` | Détail |
| `POST` | `/api/v1/professeurs` | Créer (utilisateur + profil liés) |
| `PUT` | `/api/v1/professeurs/:id` | Modifier |
| `DELETE` | `/api/v1/professeurs/:id` | Désactiver |

### Notes

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/notes?classe_id&matiere_id&periode&annee_scolaire_id` | Liste |
| `POST` | `/api/v1/notes/bulk` | Upsert en masse (valide contre note_max/min par matière) |
| `GET` | `/api/v1/notes/eleve/:eleve_id` | Notes d'un élève |

### Bulletins

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/bulletins?annee_scolaire_id&periode&filiere&eleve_id` | Liste |
| `POST` | `/api/v1/bulletins/generer` | Générer trimestriel FR·AR·COMBINE |
| `POST` | `/api/v1/bulletins/generer-annuel` | Générer annuel (periode=0) |
| `GET` | `/api/v1/bulletins/:id` | Détail avec notes par filière |
| `GET` | `/api/v1/bulletins/:id/pdf` | PDF individuel (Puppeteer) |
| `GET` | `/api/v1/bulletins/pdf-classe?classe_id&periode&filiere` | PDF toute une classe |

### Absences élèves

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/absences?classe_id&date&eleve_id&page` | Liste paginée |
| `POST` | `/api/v1/absences/bulk` | Saisie groupée (déclenche alerte si ≥ seuil) |
| `PUT` | `/api/v1/absences/:id` | Modifier (justifier, etc.) |

### Emploi du temps

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/emploi-du-temps?classe_id&annee_scolaire_id` | Créneaux par classe |
| `POST` | `/api/v1/emploi-du-temps` | Créer un créneau (valide jour actif + conflits) |
| `PUT` | `/api/v1/emploi-du-temps/:id` | Modifier |
| `DELETE` | `/api/v1/emploi-du-temps/:id` | Supprimer |

### Calendrier scolaire

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/calendrier?annee_scolaire_id&mois&annee` | Événements |
| `POST` | `/api/v1/calendrier` | Créer un événement |
| `PUT` | `/api/v1/calendrier/:id` | Modifier |
| `DELETE` | `/api/v1/calendrier/:id` | Supprimer |

### Notifications

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/notifications` | Notifications non lues de l'utilisateur courant |
| `PUT` | `/api/v1/notifications/:id/lue` | Marquer une notification comme lue |
| `PUT` | `/api/v1/notifications/lire-toutes` | Marquer toutes comme lues |

### Messagerie

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/messagerie` | Liste des conversations + indicateur non-lus |
| `POST` | `/api/v1/messagerie` | Créer une conversation (individuelle ou broadcast par rôle) |
| `GET` | `/api/v1/messagerie/:id/messages` | Messages d'une conversation |
| `POST` | `/api/v1/messagerie/:id/messages` | Envoyer un message |
| `PUT` | `/api/v1/messagerie/:id/lire` | Marquer la conversation comme lue |

### Portail parent

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `GET` | `/api/v1/portail-parent/acces/:token` | **Public** | Données complètes de l'élève (notes, paiements, absences) |
| `POST` | `/api/v1/portail-parent/generer` | JWT | Générer/renouveler le lien de portail d'un élève |
| `DELETE` | `/api/v1/portail-parent/:token/revoquer` | JWT | Révoquer un lien |
| `GET` | `/api/v1/portail-parent` | JWT | Lister les tokens actifs de l'établissement |

### Finances

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/finances/stats` | Stats du mois courant |
| `GET` | `/api/v1/finances/stats-mensuels?nb_mois=6` | Encaissements des N derniers mois |
| `GET` | `/api/v1/finances/paiements-eleves?page&search&type&statut&mois&annee` | Liste paginée |
| `POST` | `/api/v1/finances/paiements-eleves` | Créer (numéro de reçu auto `REC-YYYYMMDD-XXXXX`) |
| `GET` | `/api/v1/finances/paiements-professeurs?page&mois&annee` | Liste paginée |
| `POST` | `/api/v1/finances/paiements-professeurs` | Créer |
| `GET` | `/api/v1/finances/reliquats?mois&annee&annee_scolaire_id` | Élèves sans mensualité pour la période |

### Pointage

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/pointage/jour?date=YYYY-MM-DD` | Tous les profs actifs + présence du jour |
| `POST` | `/api/v1/pointage/bulk` | Saisie groupée d'une journée |
| `POST` | `/api/v1/pointage` | Upsert individuel |
| `GET` | `/api/v1/pointage?mois&annee&statut&professeur_id&page` | Historique paginé |
| `GET` | `/api/v1/pointage/stats?mois&annee` | Stats par professeur (taux de présence) |

### Auth (étendu)

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/v1/auth/login` | Connexion · rate-limited 5 req/min |
| `POST` | `/api/v1/auth/refresh` | Renouveler le token via refresh token |
| `POST` | `/api/v1/auth/logout` | Déconnexion + révocation du refresh token |
| `GET` | `/api/v1/auth/me` | Profil connecté |
| `PUT` | `/api/v1/auth/change-password` | Changer le mot de passe |
| `PUT` | `/api/v1/auth/profil` | Mettre à jour nom, langue, thème |
| `DELETE` | `/api/v1/auth/sessions` | Révoquer toutes les sessions actives |

### Paramètres

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/parametres` | Établissement + config notes |
| `PUT` | `/api/v1/parametres` | Modifier l'établissement |
| `GET` | `/api/v1/parametres/notes` | Config notes (inclut `jours_cours`) |
| `PUT` | `/api/v1/parametres/notes` | Modifier (note_max, note_min, seuils, jours_cours…) |
| `GET` | `/api/v1/parametres/notifications` | Préférences de notifications de l'établissement |
| `PUT` | `/api/v1/parametres/notifications` | Modifier les préférences de notifications |

### Utilisateurs

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/utilisateurs/roles` | Liste des rôles (depuis la DB) |
| `GET` | `/api/v1/utilisateurs?page&search&role` | Liste paginée |
| `POST` | `/api/v1/utilisateurs` | Créer |
| `PUT` | `/api/v1/utilisateurs/:id` | Modifier |
| `DELETE` | `/api/v1/utilisateurs/:id` | Désactiver |
| `PUT` | `/api/v1/utilisateurs/:id/reset-password` | Réinitialiser le mot de passe |

---

## Modules

### Workflow typique en début d'année

1. **Paramètres** — Vérifier l'établissement, le montant mensualité, les jours de cours actifs et la config des notes
2. **Années scolaires** — Créer l'année (ex: "2025-2026") et l'activer
3. **Matières** — Vérifier/ajouter les matières FR et AR avec coefficients et notes max
4. **Classes** — Créer les classes pour l'année
5. **Élèves** — Ajouter manuellement ou **importer via CSV** (matricule auto `DG-YYYY-NNN`)
6. **Professeurs** — Créer les comptes professeurs
7. **Emploi du temps** — Saisir les créneaux par classe
8. **Calendrier scolaire** — Enregistrer les vacances et examens
9. **Notes → Bulletins → Finances → Pointage** au fil de l'année

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

### Portail parents

Le portail parent est accessible via un lien unique sans création de compte :

1. Page **Élèves** → cliquer l'icône portail sur la ligne de l'élève
2. Cliquer **Générer le lien** → un UUID est créé (ou renouvelé)
3. Copier et partager le lien via WhatsApp ou SMS
4. Le parent voit les **notes par période**, **paiements**, **absences** et **informations de l'élève**
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
| JWT | HMAC-SHA256, expiration 7j, **fail-fast si `JWT_SECRET` absent** |
| Transport du token | `Authorization: Bearer <token>` · cookie httpOnly en secondaire |
| Stockage token (frontend) | Zustand + `localStorage` (compromis UX/sécurité — acceptable pour outil interne) |
| Mots de passe | bcrypt cost 10 |
| Auth middleware | `return reply.status(401)` — arrêt immédiat sur token invalide |
| Rate limiting | Global : 100 req/15 min par IP (`@fastify/rate-limit` v9) |
| CORS | Origine configurable via `CORS_ORIGIN` · `Authorization` explicitement autorisé |
| Multi-tenant | Chaque requête filtre par `etablissement_id` extrait du JWT |
| Validation | Zod sur tous les body POST/PUT · `z.coerce.number()` pour les Decimal Prisma |
| PDF | `escapeHtml()` sur toutes les données utilisateur avant insertion dans les templates |
| Portail parent | Token UUID en base, révocable, sans création de compte utilisateur |
| Headers HTTP | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `HSTS` (prod) |

### Flux d'authentification

```
1. POST /auth/login → { user, token }
2. Frontend stocke token dans Zustand (localStorage)
3. Chaque requête : Authorization: Bearer <token>
4. Backend : jwtVerify() → vérifie header puis cookie en fallback
5. Zod valide le payload JWT (id, role, etablissement_id, langue, theme, doit_changer_mdp)
```

### Configuration production

```bash
JWT_SECRET=<64+ caractères aléatoires>
CORS_ORIGIN=https://votre-domaine.com
NODE_ENV=production
```

> ⚠️ Changer le mot de passe admin `Admin123!` dès la première connexion.

---

## Tests

**28 tests** répartis en 4 fichiers, exécutés avec Vitest (zéro dépendance DB).

| Fichier | Fonctions testées |
|---------|------------------|
| `bulletins.test.ts` | `appreciation()`, `calculerMoyenne()` pondérée, classement |
| `pointage.test.ts` | `calcHeures()` (6 cas limites), validation statuts |
| `eleves.test.ts` | `genererMatricule()` format/padding, validation formulaire |
| `finances.test.ts` | Format reçu `REC-YYYYMMDD-XXXXX`, filtre impayé |

```bash
cd backend
npm test                 # run once
npm run test:watch       # watch mode
npm run test:coverage    # rapport HTML dans coverage/
```

---

## Roadmap — Phases à venir

L'application est pleinement fonctionnelle. Les phases ci-dessous constituent des améliorations identifiées pour la prochaine itération.

> **Modules déjà implémentés** : Évaluations formatives, Suivi de progression, Activités parascolaires, Bibliothèque scolaire, Portail parents, Documents officiels, Rapports, Refresh tokens silencieux, Gestion des sessions actives, Préférences de notifications.

---

### Phase suivante — Analytique avancée

**Objectif** : transformer les données accumulées en tableaux de bord décisionnels.

#### Tableau de bord analytique avancé

**Pourquoi** : le dashboard actuel affiche les statistiques financières et les KPI principaux. La direction a besoin d'indicateurs pédagogiques et de présence en un coup d'œil.

**Backend**
- Endpoint `GET /api/v1/stats/tableau-de-bord` retournant :
  - Taux de présence élèves par classe (semaine / mois)
  - Taux de présence professeurs (semaine / mois)
  - Moyenne générale par classe et par filière
  - Top 5 élèves + bottom 5 par établissement
  - Alertes actives (absences répétées, notes insuffisantes)

**Frontend**
- Widgets analytiques supplémentaires sur le Dashboard
- Graphiques `AreaChart` pour tendances, `BarChart` pour comparaisons par classe
- Filtres : année scolaire active, période, filière

---

#### Suivi académique pluriannuel

**Pourquoi** : impossible aujourd'hui de voir la progression d'un élève sur plusieurs années.

**Backend**
- Modèle `HistoriqueAcademique` : peuplé à la génération des bulletins
- Endpoint `GET /api/v1/eleves/:id/historique` — toutes les années de l'élève

**Frontend**
- Onglet **Historique** dans la fiche élève : graphique linéaire (Recharts)
- Portail parent : onglet Historique visible par les parents

---

### Infrastructure

#### Migration Fastify 4 → 5

`@fastify/jwt` et `@fastify/cookie` sont bloqués en v7.x car les v8+/v11+ requièrent Fastify 5.

```bash
npm install fastify@^5 @fastify/jwt@^8 @fastify/cookie@^11 @fastify/cors@^10 @fastify/rate-limit@^10
```

#### Pointage NFC

Les modèles `ProfesseurCarte`, `Pointage` et `HeureTravail` sont déjà présents en schéma. Il manque uniquement la couche API de lecture des badges NFC.

#### Application mobile (React Native)

Expo + partage des types TypeScript, mode hors-ligne pour la saisie de notes et la messagerie.

---

### Priorités suggérées

| Module | Valeur métier | Complexité |
|--------|--------------|------------|
| Suivi pluriannuel | ★★★★★ | ★★☆☆☆ |
| Dashboard analytique | ★★★★☆ | ★★★☆☆ |
| Migration Fastify 5 | ★★☆☆☆ | ★★☆☆☆ |
| Pointage NFC | ★★☆☆☆ | ★★★★☆ |
| App mobile | ★★★★★ | ★★★★★ |

---

## Dette technique

Points connus à traiter lors d'une prochaine session de dev planifiée. L'application est **pleinement fonctionnelle** en l'état.

### 1. Migration Fastify 4 → 5 *(priorité moyenne)*

`@fastify/jwt` et `@fastify/cookie` sont bloqués en v7.x car les v8+/v11+ requièrent Fastify 5. Voir Phase 5.1 ci-dessus pour les étapes.

### 2. Migration des IDs non-UUID *(priorité basse)*

Le seed utilise des IDs en clair (`'user-admin'`, `'etablissement-default'`) incompatibles avec `z.string().uuid()`. La validation Zod est assouplie à `z.string().min(1)` pour compenser. Une migration Prisma remplacerait ces IDs par de vrais UUIDs et permettrait de restaurer la validation stricte.

### 3. Token JWT en localStorage *(priorité basse)*

Le transport cross-subdomain bloque les cookies cross-origin, ce qui a nécessité le stockage en `localStorage`. Alternative propre : mettre frontend et API sur le même domaine (ex: `ecole.sn` + `ecole.sn/api`) avec un proxy nginx, puis le cookie httpOnly peut être la seule solution de transport.
