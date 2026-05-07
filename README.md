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
- [API Reference](#api-reference)
- [Modules](#modules)
- [Sécurité](#sécurité)
- [Roadmap](#roadmap)

---

## Fonctionnalités

- **Gestion des élèves** — Inscription, fiche complète, matricule auto-généré (DG-YYYY-NNN), inscription dans les classes FR et AR
- **Gestion des professeurs** — Création de comptes liés, spécialités, contrats (permanent/vacataire), salaire de base
- **Classes & Matières** — Deux filières (Française / Arabe), coefficients configurables, note max/min par matière
- **Saisie des notes** — Grille de saisie par classe/matière/période, tri alphabétique, enregistrement en masse, validation par matière
- **Bulletins scolaires** — 4 types (FR, AR, Combiné FR+AR, Annuel), calcul automatique des moyennes pondérées et du classement, export PDF par élève ou par classe entière, vue détail avec notes par matière
- **Pointage des professeurs** — Saisie journalière (Présent/Absent/Retard/Congé), heure d'arrivée et de départ avec calcul automatique de la durée, historique filtrable, statistiques mensuelles par professeur
- **Finances** — Paiements élèves (mensualités, inscriptions, blouse), filtres combinables, détection des reliquats par mois, paiements professeurs avec retenues et net à payer, auto-génération des numéros de reçu
- **Utilisateurs & Rôles** — Gestion des comptes (admin, directeur, caissier, professeur), rôles depuis la base de données, réinitialisation de mot de passe
- **Paramètres** — Configuration de l'établissement, barème des notes, nombre de périodes, montant mensualité configurable
- **Bilingue FR/AR** — Interface complète en Français et Arabe avec basculement RTL instantané
- **Dark mode** — Mode sombre persistant par utilisateur, actif aussi sur la page de connexion

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
│   │   ├── schema.prisma       # 20 modèles, multi-tenant par etablissement_id
│   │   └── seed.ts             # Données initiales (École Franco Arabe Cheikh Abdoul Ahad Mbacké)
│   └── src/
│       ├── config/database.ts  # Client Prisma singleton
│       ├── middlewares/        # authMiddleware
│       ├── modules/            # 12 modules (auth, élèves, professeurs, pointage…)
│       │   └── {module}/       # routes · controller · service · schema
│       └── server.ts           # Fastify + CORS configurable + JWT fail-fast
│
└── frontend/                   # SPA React
    └── src/
        ├── components/
        │   ├── layout/         # Sidebar, Header, Layout
        │   └── ui/             # Button, Badge, Table, Modal, Input, Select…
        ├── hooks/              # useTheme, useApi
        ├── i18n/               # Traductions FR et AR (95+ clés)
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
cp .env.example .env
# Éditer .env : DATABASE_URL, JWT_SECRET (obligatoire), CORS_ORIGIN

# Créer la base de données et appliquer le schéma
npx prisma db push

# Injecter les données initiales
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

| Variable | Description | Défaut | Obligatoire |
|----------|-------------|--------|------------|
| `DATABASE_URL` | URL de connexion PostgreSQL | — | ✅ |
| `JWT_SECRET` | Clé secrète JWT (le serveur refuse de démarrer si absente) | — | ✅ |
| `CORS_ORIGIN` | Origine autorisée pour les requêtes cross-domain | `http://localhost:5173` | En production |
| `JWT_EXPIRES_IN` | Durée de validité du token | `7d` | |
| `PORT` | Port du serveur | `3000` | |
| `NODE_ENV` | Environnement | `development` | |

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
| `POST` | `/api/v1/eleves` | Créer (matricule auto si absent) |
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
| `GET` | `/api/v1/bulletins?annee_scolaire_id&periode&filiere` | Liste |
| `POST` | `/api/v1/bulletins/generer` | Générer trimestriel (FR\|AR\|COMBINE) |
| `POST` | `/api/v1/bulletins/generer-annuel` | Générer annuel |
| `GET` | `/api/v1/bulletins/:id` | Détail avec notes par filière |
| `GET` | `/api/v1/bulletins/:id/pdf` | PDF individuel |
| `GET` | `/api/v1/bulletins/pdf-classe?classe_id&periode&filiere` | PDF toute une classe |

### Finances

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/finances/stats` | Statistiques du mois courant |
| `GET` | `/api/v1/finances/paiements-eleves?page&search&type&statut&mois&annee` | Liste paginée |
| `POST` | `/api/v1/finances/paiements-eleves` | Enregistrer un paiement (reçu auto) |
| `GET` | `/api/v1/finances/paiements-professeurs?page&mois&annee` | Liste paginée |
| `POST` | `/api/v1/finances/paiements-professeurs` | Enregistrer un paiement professeur |
| `GET` | `/api/v1/finances/reliquats?mois&annee&annee_scolaire_id` | Élèves avec mensualités manquantes |

### Pointage

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/pointage/jour?date=YYYY-MM-DD` | Tous les profs + présence du jour |
| `POST` | `/api/v1/pointage/bulk` | Saisie groupée d'une journée |
| `POST` | `/api/v1/pointage` | Upsert individuel |
| `GET` | `/api/v1/pointage?mois&annee&statut&professeur_id` | Historique paginé |
| `GET` | `/api/v1/pointage/stats?mois&annee` | Statistiques par professeur |

### Paramètres

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/parametres` | Infos établissement + config notes |
| `PUT` | `/api/v1/parametres` | Modifier l'établissement |
| `GET` | `/api/v1/parametres/notes` | Config des notes |
| `PUT` | `/api/v1/parametres/notes` | Modifier la config (note_max, note_min, montant_mensualite…) |

### Utilisateurs

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/utilisateurs?page&search&role` | Liste paginée |
| `GET` | `/api/v1/utilisateurs/roles` | Liste des rôles disponibles |
| `POST` | `/api/v1/utilisateurs` | Créer |
| `PUT` | `/api/v1/utilisateurs/:id` | Modifier |
| `DELETE` | `/api/v1/utilisateurs/:id` | Désactiver |
| `PUT` | `/api/v1/utilisateurs/:id/reset-password` | Réinitialiser le mot de passe |

---

## Modules

### Workflow typique en début d'année

1. **Paramètres** — Vérifier le nom de l'établissement, le montant mensualité et la config des notes
2. **Années scolaires** — Créer l'année (ex: "2025-2026") et l'activer
3. **Matières** — Vérifier/ajouter les matières FR et AR avec leurs coefficients et notes max
4. **Classes** — Créer les classes pour l'année
5. **Élèves** — Ajouter les élèves (matricule auto-généré) et les inscrire dans leurs classes
6. **Professeurs** — Créer les comptes professeurs
7. **Notes** → **Bulletins** → **Finances** → **Pointage** au fil de l'année

### Génération des bulletins

1. Saisir les notes (page Notes) par classe/matière/période
2. Sur la page Bulletins : sélectionner année + classe + type (FR/AR/Combiné/Annuel) + période
3. Cliquer **"Générer les bulletins"** — calcule les moyennes pondérées et le classement
4. Télécharger en PDF : individuel (bouton PDF) ou toute la classe (⬇ Télécharger tous)
5. Cliquer **Détail** pour voir les notes matière par matière dans l'interface

### Pointage des professeurs

1. Aller sur la page **Pointage** (onglet Saisie du jour)
2. Sélectionner la date (défaut : aujourd'hui)
3. Pour chaque professeur : cliquer sur le statut (Présent/Retard/Absent/Congé)
4. Saisir l'heure d'arrivée et de départ → la durée se calcule automatiquement
5. Cliquer **Enregistrer** pour sauvegarder la journée
6. Consulter l'historique et les statistiques dans les autres onglets

### Filtres paiements

La page Finances propose des filtres combinables :
- **Type** : Mensualités / Inscriptions / Autres
- **Statut** : Payés / Non payés / Manquants (reliquats — aucun enregistrement pour ce mois)
- **Période** : Mois + Année (s'applique aussi aux reliquats)

---

## Sécurité

### Mesures en place

- **Authentification** : JWT signé HMAC-SHA256, expiration configurable (défaut 7j)
- **Mots de passe** : bcrypt avec cost factor 10
- **JWT fail-fast** : le serveur refuse de démarrer si `JWT_SECRET` n'est pas défini dans l'environnement
- **CORS configurable** : via variable `CORS_ORIGIN`, plus d'URL hardcodée
- **Isolation multi-tenant** : chaque requête filtre par `etablissement_id` extrait du JWT
- **Validation des entrées** : Zod sur tous les body de requêtes POST/PUT
- **Auth middleware** : retour immédiat sur 401 (plus de continuation après rejet)
- **Échappement HTML** : toutes les données utilisateur sont échappées (`escapeHtml()`) avant insertion dans les templates PDF

### Variables à configurer en production

```bash
# Obligatoire — le serveur refuse de démarrer sans cette variable
JWT_SECRET=<clé aléatoire 64+ caractères>

# Obligatoire — restreindre CORS à votre domaine réel
CORS_ORIGIN=https://votre-domaine.com

# Recommandé
NODE_ENV=production
```

> ⚠️ **Changer le mot de passe admin** (`Admin123!`) immédiatement après la première connexion.

---

## Roadmap

### Court terme (priorité haute)

- [ ] **Tests unitaires et d'intégration** — Vitest + Supertest pour les routes critiques
- [ ] **Rate limiting** — Protection brute-force sur `/auth/login` (ex: 5 tentatives/minute)
- [ ] **Import CSV** — Import en masse des élèves depuis un fichier Excel/CSV

### Moyen terme

- [ ] **Tableau de bord enrichi** — Graphiques (présence, finances, notes moyennes par classe)
- [ ] **Module NFC** — Pointage automatique par carte NFC (`ProfesseurCarte`, `Pointage` déjà en schema)
- [ ] **Notifications** — Alertes paiements en retard, bulletins disponibles (email ou in-app)
- [ ] **Export données** — Export Excel des listes d'élèves, relevés de notes, états financiers

### Long terme

- [ ] **Application mobile** — App React Native pour les professeurs (saisie notes hors-ligne)
- [ ] **Communication parents** — Portail parents pour consulter bulletins et paiements
- [ ] **Statistiques avancées** — Analyse de progression par élève, détection des élèves en difficulté
- [ ] **Multi-établissements** — Dashboard central pour groupes scolaires
