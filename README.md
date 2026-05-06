# DaaraGest

Application web de gestion d'école franco-arabe, conçue pour les établissements scolaires au Sénégal. Gestion complète des élèves, professeurs, classes, notes, bulletins, finances et utilisateurs, avec interface bilingue Français/Arabe.

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Identité graphique](#identité-graphique)
- [Installation](#installation)
- [Variables d'environnement](#variables-denvironnement)
- [Comptes par défaut](#comptes-par-défaut)
- [API Reference](#api-reference)
- [Modules](#modules)
- [Sécurité](#sécurité)
- [Roadmap](#roadmap)

---

## Fonctionnalités

- **Gestion des élèves** — Inscription, fiche complète, inscription dans les classes FR et AR
- **Gestion des professeurs** — Création de comptes liés, spécialités, contrats
- **Classes & Matières** — Deux filières (Française / Arabe), coefficients configurables
- **Saisie des notes** — Grille de saisie par classe/matière/période, enregistrement en masse
- **Bulletins scolaires** — Calcul automatique des moyennes pondérées et du classement, export PDF par élève ou par classe entière
- **Finances** — Suivi des paiements élèves (mensualités, frais d'inscription), paiements professeurs
- **Utilisateurs & Rôles** — Gestion des comptes (admin, directeur, caissier, professeur), réinitialisation de mot de passe
- **Paramètres** — Configuration de l'établissement, barème des notes, nombre de périodes
- **Bilingue FR/AR** — Interface complète en Français et Arabe avec basculement RTL instantané
- **Dark mode** — Mode sombre persistant par utilisateur

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 18, Vite, Tailwind CSS, i18next, Zustand |
| Backend | Node.js, Fastify v4, Prisma ORM |
| Base de données | PostgreSQL 15+ |
| Authentification | JWT (jsonwebtoken via @fastify/jwt) + bcrypt (cost 10) |
| Validation | Zod |
| PDF | Puppeteer (Chromium bundlé) |
| Tests | — (à venir) |

---

## Architecture

```
DaaraGest/
├── backend/                    # API REST Fastify
│   ├── prisma/
│   │   ├── schema.prisma       # 18 modèles, multi-tenant par etablissement_id
│   │   └── seed.ts             # Données initiales
│   └── src/
│       ├── config/database.ts  # Client Prisma singleton
│       ├── middlewares/        # authMiddleware, requireRole()
│       ├── modules/            # 11 modules (auth, élèves, professeurs…)
│       │   └── {module}/       # routes · controller · service · schema
│       └── server.ts           # Fastify + CORS + JWT
│
└── frontend/                   # SPA React
    └── src/
        ├── components/
        │   ├── layout/         # Sidebar, Header, Layout
        │   └── ui/             # Button, Badge, Table, Modal, Input…
        ├── hooks/              # useAuth, useTheme, useApi
        ├── i18n/               # Traductions FR et AR
        ├── pages/              # Un dossier par module
        └── store/              # authStore (Zustand + persist)
```

### Isolation multi-établissements

Chaque requête authentifiée extrait `etablissement_id` du JWT. Tous les services filtrent systématiquement par cet identifiant — aucune donnée d'un autre établissement n'est accessible.

### Rôles et permissions

| Rôle | Accès |
|------|-------|
| `admin` | Tous les modules |
| `directeur` | Tous sauf gestion utilisateurs |
| `caissier` | Dashboard, Élèves, Finances |
| `professeur` | Dashboard, Classes, Notes, Bulletins |

---

## Identité graphique

### Palette chromatique

| Rôle | Nom | Hex | Usage |
|------|-----|-----|-------|
| Primaire | Émeraude | `#10B981` | Actions, liens actifs, CTA |
| Secondaire | Teal | `#14B8A6` | Gradients, info, badges |
| Accent | Or Sénégal | `#F59E0B` | Points d'excellence, indicateurs actifs |
| Fond | Nuit | `#0F172A` | Sidebar, login panel, dark bg |
| Surface | Ardoise | `#1E293B` | Cartes dark, header dark |
| Interface | Lumière | `#F1F5F9` | Fond principal light mode |

### Typographie

| Usage | Police | Poids |
|-------|--------|-------|
| Titres & Logo | Big Shoulders Display | 800–900 |
| Interface & Corps | Instrument Sans | 400–700 |
| Arabe | Noto Naskh Arabic | 400–700 |

### Logo

Le logo DaaraGest est composé de :
- **Arc émeraude** — porte du savoir, héritage du Daara sénégalais
- **Lettre D** géométrique blanche — DaaraGest, construite avec précision
- **Arc or + point doré** — chaleur, excellence, accent sénégalais
- **Cercle** — communauté, complétude, cycle scolaire

### Design tokens (CSS)

```css
--color-primary:   #10B981;
--color-secondary: #14B8A6;
--color-accent:    #F59E0B;
--color-bg:        #0F172A;
--color-surface:   #1E293B;
--color-light:     #F1F5F9;
--font-display:    'Big Shoulders Display', system-ui, sans-serif;
--font-body:       'Instrument Sans', system-ui, sans-serif;
```

---

## Installation

### Prérequis

- Node.js 20+
- PostgreSQL 15+

### 1. Cloner le dépôt

```bash
git clone https://github.com/kriimoohh/DaaraGest.git
cd DaaraGest
```

### 2. Backend

```bash
cd backend
npm install

# Copier et configurer les variables d'environnement
cp ../.env.example .env
# Éditer .env : DATABASE_URL, JWT_SECRET (obligatoire en production)

# Créer la base de données
npx prisma db push

# Injecter les données initiales (établissement + rôles + admin + matières)
npm run db:seed

# Démarrer en développement
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

L'application est accessible sur **http://localhost:5173**

---

## Variables d'environnement

### Backend (`backend/.env`)

| Variable | Description | Défaut |
|----------|-------------|--------|
| `DATABASE_URL` | URL de connexion PostgreSQL | — (obligatoire) |
| `JWT_SECRET` | Clé secrète JWT | ⚠️ obligatoire en production |
| `JWT_EXPIRES_IN` | Durée de validité du token | `7d` |
| `PORT` | Port du serveur | `3000` |
| `NODE_ENV` | Environnement | `development` |

### Frontend (`frontend/.env`)

| Variable | Description | Défaut |
|----------|-------------|--------|
| `VITE_API_URL` | URL de l'API backend | `http://localhost:3000` |

---

## Comptes par défaut

Créés par le seed. **À changer impérativement en production.**

| Identifiant | Mot de passe | Rôle |
|-------------|-------------|------|
| `admin` | `Admin123!` | Administrateur |

---

## API Reference

Toutes les routes (sauf `/health` et `/api/v1/auth/login`) requièrent un header `Authorization: Bearer <token>`.

### Authentification

| Méthode | Route | Description |
|---------|-------|-------------|
| `POST` | `/api/v1/auth/login` | Connexion — retourne `{ token, user }` |
| `GET` | `/api/v1/auth/me` | Profil de l'utilisateur connecté |
| `POST` | `/api/v1/auth/logout` | Déconnexion |

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
| `GET` | `/api/v1/matieres?filiere=FR\|AR` | Liste (filtre optionnel) |
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
| `GET` | `/api/v1/eleves?page&search&classe_id&actif` | Liste paginée |
| `GET` | `/api/v1/eleves/:id` | Détail + parents + inscriptions |
| `POST` | `/api/v1/eleves` | Créer |
| `PUT` | `/api/v1/eleves/:id` | Modifier |
| `DELETE` | `/api/v1/eleves/:id` | Désactiver |
| `POST` | `/api/v1/eleves/:id/inscrire` | Inscrire dans une classe |

### Professeurs

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/professeurs?page&search` | Liste paginée |
| `GET` | `/api/v1/professeurs/:id` | Détail |
| `POST` | `/api/v1/professeurs` | Créer (user + profil liés) |
| `PUT` | `/api/v1/professeurs/:id` | Modifier |
| `DELETE` | `/api/v1/professeurs/:id` | Désactiver |

### Notes

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/notes?classe_id&matiere_id&periode&annee_scolaire_id` | Liste |
| `POST` | `/api/v1/notes/bulk` | Enregistrement en masse (upsert) |
| `GET` | `/api/v1/notes/eleve/:eleve_id` | Notes d'un élève |

### Bulletins

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/bulletins?annee_scolaire_id&periode&eleve_id` | Liste |
| `POST` | `/api/v1/bulletins/generer` | Générer (calcul moyenne + rang) |
| `GET` | `/api/v1/bulletins/pdf-classe?classe_id&annee_scolaire_id&periode&filiere` | PDF de toute une classe |
| `GET` | `/api/v1/bulletins/:id` | Détail avec notes |
| `GET` | `/api/v1/bulletins/:id/pdf` | PDF individuel |

### Finances

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/finances/stats` | Statistiques du mois courant |
| `GET` | `/api/v1/finances/paiements-eleves?page&search&type&mois&annee` | Liste paginée |
| `POST` | `/api/v1/finances/paiements-eleves` | Enregistrer un paiement élève |
| `GET` | `/api/v1/finances/paiements-professeurs?page&mois&annee` | Liste paginée |
| `POST` | `/api/v1/finances/paiements-professeurs` | Enregistrer un paiement professeur |

### Paramètres

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/parametres` | Infos établissement + config notes |
| `PUT` | `/api/v1/parametres` | Modifier l'établissement |
| `GET` | `/api/v1/parametres/notes` | Config des notes |
| `PUT` | `/api/v1/parametres/notes` | Modifier la config des notes |

### Utilisateurs

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/utilisateurs?page&search&role` | Liste paginée |
| `POST` | `/api/v1/utilisateurs` | Créer |
| `PUT` | `/api/v1/utilisateurs/:id` | Modifier |
| `DELETE` | `/api/v1/utilisateurs/:id` | Désactiver |
| `PUT` | `/api/v1/utilisateurs/:id/reset-password` | Réinitialiser le mot de passe |

---

## Modules

### Workflow typique en début d'année

1. **Paramètres** — Vérifier le nom de l'établissement et la config des notes
2. **Années scolaires** — Créer l'année (ex: "2025-2026") et l'activer
3. **Matières** — Vérifier/ajouter les matières FR et AR avec leurs coefficients
4. **Classes** — Créer les classes pour l'année
5. **Élèves** — Importer les élèves et les inscrire dans leurs classes
6. **Professeurs** — Créer les comptes professeurs
7. **Notes** → **Bulletins** → **Finances** au fil de l'année

### Génération des bulletins

1. Saisir les notes (page Notes) par classe/matière/période
2. Sur la page Bulletins : sélectionner classe + période + filière
3. Cliquer **"Générer les bulletins"** — calcule les moyennes pondérées et le classement
4. Télécharger en PDF : individuel (bouton PDF sur chaque ligne) ou toute la classe (bouton "⬇ Télécharger tous")

---

## Sécurité

### Mesures en place

- **Authentification** : JWT signé HMAC-SHA256, expiration configurable (défaut 7j)
- **Mots de passe** : bcrypt avec cost factor 10
- **Isolation multi-tenant** : chaque requête filtre par `etablissement_id` extrait du JWT — impossibilité d'accéder aux données d'un autre établissement
- **Validation des entrées** : Zod sur tous les body de requêtes POST/PUT
- **Autorisation** : middleware `requireRole()` disponible, toutes les routes nécessitent un JWT valide
- **CORS** : restreint à l'origine frontend configurée
- **Échappement HTML** : toutes les données utilisateur sont échappées avant insertion dans les templates PDF (protection XSS/injection)

### Points à configurer en production

```bash
# Obligatoire : changer le secret JWT
JWT_SECRET=<clé aléatoire longue>

# Restreindre CORS à votre domaine réel dans backend/src/server.ts
origin: 'https://votre-domaine.com'

# Variables NODE_ENV
NODE_ENV=production
```

> ⚠️ **Ne jamais déployer avec le secret JWT par défaut** (`fallback-secret-change-in-production`). Un attaquant connaissant ce secret peut forger des tokens valides.

---

## Roadmap

- [ ] **Module NFC** — Pointage des professeurs par carte NFC (modèles DB déjà en place : `ProfesseurCarte`, `Pointage`, `HeureTravail`)
- [ ] **Tests** — Tests unitaires (Vitest) et d'intégration
- [ ] **Rate limiting** — Limitation des tentatives de connexion (protection brute-force)
- [ ] **Import CSV** — Import en masse des élèves
- [ ] **Notifications** — Alertes paiements manquants, bulletins disponibles
- [ ] **Tableau de bord avancé** — Graphiques de présence, statistiques financières
