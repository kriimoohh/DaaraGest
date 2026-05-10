# DaaraGest

Application web de gestion d'école franco-arabe, conçue pour les établissements scolaires au Sénégal. Gestion complète des élèves, professeurs, classes, notes, bulletins, finances, pointage et utilisateurs, avec interface bilingue Français/Arabe.

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
- [Roadmap](#roadmap)

---

## Fonctionnalités

| Module | Description |
|--------|-------------|
| **Élèves** | Inscription, fiche complète, matricule auto-généré `DG-YYYY-NNN`, import en masse via CSV |
| **Professeurs** | Comptes liés à un utilisateur, spécialités, type de contrat, salaire de base |
| **Classes** | Deux filières (Française / Arabe), niveaux, capacité, par année scolaire |
| **Matières** | Coefficients, note max/min configurables par matière |
| **Notes** | Saisie en masse par classe/matière/période, tri alphabétique, validation par matière |
| **Bulletins** | 4 types (FR · AR · Combiné · Annuel), moyennes pondérées, classement, export PDF individuel ou classe entière, vue détail avec notes par matière |
| **Pointage** | Saisie journalière présence/absence/retard/congé, heure d'arrivée/départ avec calcul auto de la durée, historique filtrable, statistiques mensuelles par professeur |
| **Finances** | Paiements élèves (mensualités, inscriptions, blouse), filtres combinables type+statut+période, reliquats par mois, paiements professeurs, numéros de reçu auto-générés |
| **Utilisateurs** | Rôles depuis la DB, réinitialisation de mot de passe |
| **Paramètres** | Établissement, barème des notes, montant mensualité configurable |
| **Dashboard** | Statistiques clés, graphique des encaissements sur 6 mois (Recharts), résumé financier du mois |
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

---

## Architecture

```
DaaraGest/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # 20 modèles, multi-tenant etablissement_id
│   │   └── seed.ts              # École Franco Arabe Cheikh Abdoul Ahad Mbacké
│   └── src/
│       ├── middlewares/         # authMiddleware (return sur 401)
│       ├── modules/             # 12 modules
│       │   ├── auth/            # login, me
│       │   ├── annees-scolaires/
│       │   ├── classes/
│       │   ├── eleves/          # + import CSV bulk
│       │   ├── matieres/
│       │   ├── notes/           # bulk upsert
│       │   ├── bulletins/       # 4 types + PDF Puppeteer
│       │   ├── finances/        # paiements + reliquats + stats mensuelles
│       │   ├── parametres/      # établissement + configNotes
│       │   ├── pointage/        # présences manuelles
│       │   ├── professeurs/
│       │   └── utilisateurs/    # + GET /roles
│       └── server.ts            # Fastify + CORS configurable + JWT fail-fast
│
└── frontend/
    └── src/
        ├── components/
        │   ├── layout/          # Sidebar (12 items, role-based), Layout
        │   └── ui/              # Button, Badge, Table, Modal, Input, Select,
        │                        #   SearchInput, Pagination, ConfirmModal, PageHeader
        ├── hooks/               # useApi, useAuth, useTheme
        ├── i18n/fr/ + i18n/ar/  # 110+ clés de traduction
        ├── pages/               # 11 pages (+ Dashboard)
        ├── lib/api.ts           # fetch wrapper
        └── store/               # authStore (Zustand + persist)
```

### Modèles Prisma (20)

`Etablissement` · `Role` · `Utilisateur` · `AnneeScolaire` · `Classe` · `Matiere` · `Eleve` · `Parent` · `Inscription` · `Note` · `Bulletin` · `PaiementEleve` · `PaiementProfesseur` · `Professeur` · `ProfesseurCarte` · `Pointage` · `HeureTravail` · `PresenceProfesseur` · `ProfMatiereClasse` · `ConfigNotes`

### Isolation multi-établissements

Chaque requête authentifiée extrait `etablissement_id` du JWT. Tous les services filtrent par cet identifiant — aucune donnée d'un autre établissement n'est accessible.

### Rôles et accès

| Rôle | Pages accessibles |
|------|------------------|
| `admin` | Toutes |
| `directeur` | Toutes sauf Utilisateurs et Paramètres |
| `gestionnaire` | Dashboard, Élèves, Professeurs, Classes, Années, Matières, Notes, Bulletins, Absences, Pointage |
| `agent de scolarité` | Dashboard, Élèves, Classes, Notes, Bulletins, Absences, Finances |
| `professeur` | Dashboard, Classes, Notes, Bulletins, Absences |
| `pointeur` | Dashboard, Professeurs, Absences, Pointage |

### Bulletins — filières et types

| Type | Description |
|------|-------------|
| `FR` | Bulletin filière française uniquement |
| `AR` | Bulletin filière arabe uniquement |
| `COMBINE` | Bulletins FR et AR fusionnés sur une même fiche — la moyenne couvre les deux filières |

> La filière d'un bulletin (`COMBINE`) ne correspond pas à la filière d'une classe (toujours `FR` ou `AR`). Un élève inscrit dans une classe FR **et** une classe AR peut recevoir un bulletin `COMBINE`.

---

## Identité graphique

| Rôle | Couleur | Hex |
|------|---------|-----|
| Primaire | Émeraude | `#10B981` |
| Secondaire | Teal | `#14B8A6` |
| Accent | Or Sénégal | `#F59E0B` |
| Fond dark | Nuit | `#0F172A` |
| Surface dark | Ardoise | `#1E293B` |

Polices : **Big Shoulders Display** (titres, 800–900) · **Instrument Sans** (corps, 400–700) · **Noto Naskh Arabic** (arabe)

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
npx prisma db push

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

Toutes les routes (sauf `/health` et `POST /api/v1/auth/login`) requièrent `Authorization: Bearer <token>`.

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
| `POST` | `/api/v1/bulletins/generer` | Générer trimestriel FR·AR·COMBINE (fetch groupé, plus de N+1) |
| `POST` | `/api/v1/bulletins/generer-annuel` | Générer annuel (periode=0) |
| `GET` | `/api/v1/bulletins/:id` | Détail avec notes par filière |
| `GET` | `/api/v1/bulletins/:id/pdf` | PDF individuel (Puppeteer) |
| `GET` | `/api/v1/bulletins/pdf-classe?classe_id&periode&filiere` | PDF toute une classe |

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
| `GET` | `/api/v1/pointage/jour?date=YYYY-MM-DD` | Tous les profs actifs + présence du jour (pré-remplie) |
| `POST` | `/api/v1/pointage/bulk` | Saisie groupée d'une journée |
| `POST` | `/api/v1/pointage` | Upsert individuel |
| `GET` | `/api/v1/pointage?mois&annee&statut&professeur_id&page` | Historique paginé |
| `GET` | `/api/v1/pointage/stats?mois&annee` | Stats par professeur (taux de présence) |

### Paramètres

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/parametres` | Établissement + config notes |
| `PUT` | `/api/v1/parametres` | Modifier l'établissement |
| `GET` | `/api/v1/parametres/notes` | Config notes |
| `PUT` | `/api/v1/parametres/notes` | Modifier (note_max, note_min, montant_mensualite…) |

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

1. **Paramètres** — Vérifier l'établissement, le montant mensualité et la config des notes
2. **Années scolaires** — Créer l'année (ex: "2025-2026") et l'activer
3. **Matières** — Vérifier/ajouter les matières FR et AR avec coefficients et notes max
4. **Classes** — Créer les classes pour l'année
5. **Élèves** — Ajouter manuellement ou **importer via CSV** (matricule auto `DG-YYYY-NNN`)
6. **Professeurs** — Créer les comptes professeurs
7. **Notes → Bulletins → Finances → Pointage** au fil de l'année

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

### Génération des bulletins

1. Saisir les notes par classe / matière / période
2. Page Bulletins : sélectionner année + classe + type + période
3. **Générer** — calcule les moyennes pondérées et le classement
4. **Détail** — voir les notes matière par matière (table T1·T2·T3·Moy. pour les annuels)
5. **Télécharger PDF** individuel ou toute la classe

### Pointage des professeurs

1. Page Pointage → onglet **Saisie du jour**
2. Sélectionner la date (défaut : aujourd'hui)
3. Pour chaque professeur : statut + heure d'arrivée + heure de départ
4. La durée réelle se calcule automatiquement
5. **Enregistrer** — les données sont préservées si on revient sur la même date

### Filtres paiements (combinables)

- **Type** : Mensualités · Inscriptions · Autres
- **Statut** : Payés · Non payés · Manquants (reliquats — aucun enregistrement pour ce mois)
- **Période** : Mois + Année (s'applique aussi aux reliquats)

---

## Sécurité

| Mesure | Détail |
|--------|--------|
| JWT | HMAC-SHA256, expiration 7j, **fail-fast si `JWT_SECRET` absent** |
| Transport du token | `Authorization: Bearer <token>` sur chaque requête · cookie httpOnly posé en parallèle comme mécanisme secondaire |
| Stockage token (frontend) | Zustand + `localStorage` (compromis UX/sécurité — acceptable pour outil interne) |
| Mots de passe | bcrypt cost 10 |
| Auth middleware | `return reply.status(401)` — arrêt immédiat sur token invalide |
| Rate limiting | Global : 100 req/15 min par IP (`@fastify/rate-limit` v9) |
| CORS | Origine configurable via `CORS_ORIGIN` · `Authorization` explicitement autorisé dans `allowedHeaders` |
| Multi-tenant | Chaque requête filtre par `etablissement_id` extrait du JWT |
| Validation | Zod sur tous les body POST/PUT · `z.coerce.number()` pour les Decimal Prisma |
| PDF | `escapeHtml()` sur toutes les données utilisateur avant insertion dans les templates |
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

## Dette technique

Points connus à traiter lors d'une prochaine session de dev planifiée. L'application est **pleinement fonctionnelle** en l'état.

### 1. Migration Fastify 4 → 5 *(priorité moyenne)*

`@fastify/jwt` et `@fastify/cookie` sont bloqués en v7.x car les v8+/v11+ requièrent Fastify 5. La migration permettrait de revenir aux dernières versions des plugins.

```bash
# Étapes approximatives
npm install fastify@^5 @fastify/jwt@^8 @fastify/cookie@^11 @fastify/cors@^10 @fastify/rate-limit@^10
# Tester toutes les routes, vérifier les breaking changes Fastify 5
```

### 2. Migration des IDs non-UUID *(priorité basse)*

Le seed utilise des IDs en clair (`'user-admin'`, `'etablissement-default'`) incompatibles avec `z.string().uuid()`. La validation Zod est actuellement assouplie à `z.string().min(1)` pour compenser. Une migration Prisma remplacerait ces IDs par de vrais UUIDs et permettrait de restaurer la validation stricte.

### 3. Token JWT en localStorage *(priorité basse)*

L'audit de sécurité visait un stockage exclusif en cookie httpOnly. Le transport cross-subdomain Railway (`dg.sakai.sn` → `api.dg.sakai.sn`) bloque les cookies cross-origin, ce qui a nécessité le passage au Bearer token stocké en localStorage. Alternative propre : mettre frontend et API sur le même domaine (ex: `ecole.sn` + `ecole.sn/api`), ou utiliser un proxy nginx.

---

## Roadmap

### À venir (moyen terme)

- [ ] **Notifications** — Alertes paiements en retard, bulletins disponibles (email ou in-app)
- [ ] **Module NFC** — Pointage automatique par badge (modèles `Pointage` · `HeureTravail` · `ProfesseurCarte` déjà en schéma)
- [ ] **Refresh token** — Renouvellement silencieux du JWT (actuellement expiration 7j)

### Long terme

- [ ] **Portail parents** — Consultation bulletins + paiements
- [ ] **App mobile** — React Native, saisie notes hors-ligne
- [ ] **Multi-établissements** — Dashboard central pour groupes scolaires
- [ ] **Statistiques avancées** — Analyse de progression par élève, détection des difficultés
