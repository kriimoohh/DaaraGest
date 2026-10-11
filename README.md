# DaaraGest

Application web de gestion scolaire multi-filières, conçue pour tout établissement au Sénégal — **franco-arabe, bilingue ou classique** — grâce à des filières entièrement configurables par établissement (FR / AR / EN et toute combinaison, sans hypothèse de bilinguisme imposée). Gestion complète des élèves, du personnel, des classes, notes, bulletins, cahier de texte, finances, pointage (manuel et QR), emploi du temps, messagerie interne, bibliothèque et portail parents — interface **trilingue Français / Arabe / Anglais** (RTL pour l'arabe) et landing page publique.

> **Mono-établissement aujourd'hui, pensé pour devenir un SaaS multi-tenant.** Le socle multi-tenant existe (`etablissement_id` sur toutes les tables, JWT scopé, garde-fous d'établissement vérifiés par des tests d'intégration) ; chaque établissement est déployé séparément (en production : un service API, un service front et une base PostgreSQL sur Railway). La bascule vers une offre SaaS multi-établissement (isolation RLS, onboarding, facturation) est un plan documenté, pas encore implémenté — voir [`docs/SAAS-INFRA-PLAN.md`](docs/SAAS-INFRA-PLAN.md) et la section [Phase 4 — Multi-établissement](#phase-4--multi-établissement).

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
- [Déploiement](#déploiement)
- [Scripts de maintenance et d'import](#scripts-de-maintenance-et-dimport)
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
| **Classes** | Rattachées à une filière et un niveau, capacité, par année scolaire ; duplication vers une autre filière ; **reconduction d'une année à l'autre** (toutes les classes ou une sélection, avec ou sans le programme de matières, aperçu avant écriture) ; matières de la classe avec **overrides de coefficient/barème par classe et par période** ; listes PDF |
| **Matières** | Coefficient, note min et **barème de saisie (note max)** par défaut sur la matière, overridables par classe/période ; rattachement à un **domaine pédagogique** ; type Ressource/Compétence pour les grilles IEF |
| **Domaines** | Domaines pédagogiques IEF (Langue & Communication, Mathématiques, ESVS, EPSA…), grilles par groupe de niveau (CI-CP / CE1-CE2 / CM1-CM2) |
| **Notes** | Saisie en masse par classe/matière/période, validation sur le barème effectif, suppression en masse ; un **professeur ne voit et ne saisit que ses classes** (réglage « toutes les matières » : ses matières seulement ou toutes les matières de ses classes) |
| **Évaluations** | Évaluations formatives (devoir, contrôle, test d'entrée, examen…) avec pondération |
| **Cahier de texte** | Séances faites (contenu, objectif) et devoirs à faire (leçon/exercice/récitation/autre) par classe×matière×date, vue « Ma journée » alignée sur l'emploi du temps, **visa de la direction** avec verrouillage de la période visée, indicateur de **complétude** (prévu vs. renseigné), export PDF (inspection), devoirs visibles côté portail parent |
| **Bulletins** | Par filière (**FR / AR / EN** — options construites dynamiquement selon les filières actives de l'établissement) + **combiné au choix** (`filieres_combine`) + annuel ; moyennes pondérées, **mentions configurables** (par filière et/ou niveau), **échelle d'affichage par niveau** (`Niveau.note_max`), classement, **verrouillage de période** (préflight + déverrouillage direction), **templates HTML éditables** (FR/AR/COMBINE/ANNUEL), **aperçu PDF avant téléchargement**, export PDF individuel ou classe entière, **suivi de l'état de génération** (à jour / périmé / partiel — recalculé après toute saisie de notes) avec **régénération automatique** des bulletins impactés et **nettoyage des orphelins** |
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
| **Portail parents** | Page publique sans compte (lien UUID, **expiration automatique à la fin de l'année scolaire active**) : notes, paiements, absences, devoirs (cahier de texte), informations de l'élève, **téléchargement des bulletins PDF** ; **rotation** du lien et **écran dédié de gestion** (liste, statut actif/révoqué/expiré, recherche, révocation) |
| **Bibliothèque** | Catalogue des livres, gestion des prêts/retours, suivi du stock et des retards |
| **Finances** | Paiements élèves (mensualités, inscriptions, saisie en masse), reliquats, paiements du personnel, numéros de reçu auto, **reçu de paiement individuel en PDF A5** (aux couleurs du site), **exports Excel/PDF**, **catalogue de tarifs configurable** — jamais accessible au directeur ni au conseiller pédagogique |
| **Documents officiels** | 25 types de documents (certificats, attestations, cartes élève/professeur avec QR, fiches de paie, convocations…) générés en PDF à partir de templates personnalisables, aperçu et génération par lot |
| **Rapports** | Présences (élèves/personnel), résultats par classe, bilan financier, **grilles IEF**, performance par domaine, relevés de notes, propositions de fin d'année, charges du personnel — avec aperçus HTML |
| **Audit** | Journal d'audit **lisible par un non-informaticien** : chaque entrée est une phrase avec les noms réels (« X a enregistré un paiement de 25 000 FCFA pour Sira Sow — reçu REC-… »), traduite FR/AR/EN ; filtres par personne, type d'action, type de donnée et période ; accès direction |
| **Utilisateurs** | Sept rôles depuis la DB (dont **conseiller pédagogique**, aux droits du directeur) ; réinitialisation de mot de passe (déverrouille le compte et coupe toutes ses sessions), désactivation/réactivation, suppression définitive ; changement de mot de passe **obligatoire** à la première connexion |
| **Paramètres** | Établissement (code matricule, devise, en-têtes de bulletin FR/AR, logo/signature/cachet), config des notes (échelle, **périodes configurables** : nombre + noms FR/AR trimestres/semestres), niveaux, tarifs, fonctions, mentions, jours de cours, préférences de notifications, rendu des bulletins, politique de saisie des notes |
| **Dashboard** | Statistiques clés, graphique des encaissements (Recharts) + tableau de bord analytique direction |
| **i18n FR/AR/EN** | Interface trilingue (français, arabe, anglais — fallback FR) avec sélecteur de langue et bascule RTL instantanée pour l'arabe |
| **Aide contextuelle** | Bouton « ? » dans la barre du haut : rappel de l'objectif de la page courante et astuces d'utilisation, traduits FR/AR/EN, sur chaque écran de l'application |
| **Dark mode** | Persistant par utilisateur, actif dès la page de connexion |
| **Observabilité** | Sentry (backend + frontend) — capture des erreurs 5xx uniquement ; health check `/health` (DB + moteur PDF) ; messages d'erreur 5xx anonymisés |

---

## Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Runtime | Node.js | **20** (Docker, CI) |
| Backend | Fastify | **5.x** |
| ORM | Prisma | 5.x |
| Base de données | PostgreSQL | 15+ (**production : 18**, CI : 16) |
| Authentification | @fastify/jwt v10 + @fastify/cookie v11 + bcryptjs | cost 10 |
| Rate limiting | @fastify/rate-limit | 10.x |
| Validation | Zod (env + payloads, coerce pour les Decimal Prisma) | 3.x |
| PDF | Puppeteer (+ pdf-lib), Chromium système dans l'image Docker | 24.x |
| Excel | ExcelJS | 4.x |
| QR codes | qrcode (backend, signés HMAC) + html5-qrcode (scanner frontend) | — |
| Observabilité | @sentry/node + @sentry/react | 10.x |
| Tests | Vitest + Testing Library (frontend) | 4.x |
| Frontend | React 18 + Vite 5 | — |
| Styles | Tailwind CSS (darkMode: class) | 3.x |
| État global | Zustand + persist | — |
| i18n | i18next + react-i18next | — |
| Graphiques | Recharts | 3.x |
| Import CSV | PapaParse | — |
| Routing | react-router-dom v6 (flags v7 activés) | 6.30.x |
| Hébergement | Railway : 3 services (API Docker, front nginx, PostgreSQL) | — |

> **Note CLI Prisma** : le CLI global peut être en v7.x alors que le projet utilise Prisma v5. Toujours utiliser `./node_modules/.bin/prisma` (ou `npx prisma`) dans ce projet pour éviter les conflits de version.

---

---

## Architecture

```
DaaraGest/
├── .github/workflows/ci.yml     # CI : type-check, lint, tests, build, intégration Postgres,
│                                #   installation à neuf (migrations + seed sur base vierge)
├── docs/SAAS-INFRA-PLAN.md      # plan de bascule SaaS multi-établissement (non implémenté)
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # 57 modèles, multi-tenant etablissement_id
│   │   ├── migrations/          # migrations rejouables depuis zéro (testé en CI)
│   │   ├── seed.ts              # seed de développement (admin + comptes de test)
│   │   ├── seed-prod.cjs        # seed idempotent exécuté au boot (rôles, niveaux, fonctions,
│   │   │                        #   admin initial ; marche sur base vierge)
│   │   └── lgm/ · personnel-ficaam/ · data/   # scripts d'import historiques (voir plus bas)
│   ├── Dockerfile · entrypoint.sh             # image de production (Chromium inclus)
│   └── src/
│       ├── config/
│       │   ├── env.ts           # validation Zod des variables d'env (fail-fast)
│       │   ├── roles.ts         # ROLES + ROLE_GROUPS (DIRECTION, GESTION, SCOLARITE, ACADEMIQUE,
│       │   │                    #   PRESENCE, FINANCES/FINANCES_GESTION — directeur exclu…)
│       │   └── sentry.ts        # Sentry (no-op si SENTRY_DSN absent)
│       ├── middlewares/         # authMiddleware (jeton + état de session), requireRole
│       ├── utils/               # portee (périmètre professeur), sessions (révocation),
│       │                        #   errorHandler (erreurs → réponses HTTP), echecsConnexion,
│       │                        #   fileAttente + browserPool (PDF Puppeteer), csrf, microTemplate,
│       │                        #   teachingPolicy, sanitize (payloads curés par rôle)…
│       ├── modules/             # 34 modules API (+ dossiers de tests transverses :
│       │                        #   integration, metier, rbac, security, validation)
│       │   ├── auth/            # login, refresh, logout, me, change-password, profil
│       │   ├── annees-scolaires/
│       │   ├── filieres/        # entité Filiere (FR/AR/EN…, N par établissement)
│       │   ├── niveaux/         # + échelle d'affichage par niveau (note_max)
│       │   ├── domaines/        # domaines pédagogiques IEF
│       │   ├── classes/         # + matières de classe, overrides par période, PDF listes,
│       │   │                    #   reconduction d'une année à l'autre
│       │   ├── matieres/
│       │   ├── mentions/        # mentions configurables (filière/niveau)
│       │   ├── tarifs/          # catalogue des tarifs facturés aux familles
│       │   ├── fonctions/       # fonctions du personnel configurables
│       │   ├── eleves/          # + import CSV, export Excel, bulk, QR, transfert
│       │   ├── personnel/       # + affectations matière×classe
│       │   ├── notes/           # bulk upsert + bulk suppression + régénération
│       │   │                    #   auto des bulletins impactés
│       │   ├── evaluations/     # évaluations formatives, notes, moyennes
│       │   ├── cahier/          # cahier de texte : séances, devoirs, visa direction
│       │   ├── bulletins/       # FR/AR/EN + combiné au choix + annuel,
│       │   │                    #   verrouillage de période, templates éditables, PDF,
│       │   │                    #   état de génération + régénération + orphelins
│       │   ├── absences/        # absences élèves + stats + alertes
│       │   ├── progression/     # suivi pluriannuel
│       │   ├── activites/       # activités parascolaires, séances, présences
│       │   ├── finances/        # paiements, reliquats, reçu PDF A5, exports Excel/PDF, stats
│       │   ├── parametres/      # établissement + configNotes + politique de saisie
│       │   ├── pointage/        # présences manuelles + QR (scan public signé HMAC,
│       │   │                    #   payload minimal — jamais salaire/CNI/qr_token)
│       │   ├── demandes-absence-personnel/
│       │   ├── utilisateurs/    # + réactivation, suppression définitive, GET /roles
│       │   ├── emploi-du-temps/ # créneaux, conflits, jours actifs
│       │   ├── calendrier/      # événements scolaires
│       │   ├── notifications/   # in-app, marquer lue(s)
│       │   ├── messagerie/      # conversations, messages, broadcast
│       │   ├── portail-parent/  # tokens UUID, expiration auto, rotation, audit,
│       │   │                    #   accès public, bulletins PDF, devoirs
│       │   ├── documents/       # templates, génération PDF, aperçu, lots, historique
│       │   ├── stats/           # tableau de bord analytique direction
│       │   ├── rapports/        # présences, résultats, bilan financier, grilles IEF…
│       │   ├── audit/           # journal d'audit (direction) + phrases lisibles (audit-phrases)
│       │   ├── rbac/            # tests transverses : matrice de rôles + anti-fuite
│       │   │                    #   de payloads (payloads.itest.ts)
│       │   └── bibliotheque/    # catalogue livres, emprunts, retours
│       └── server.ts            # Fastify 5 + CORS + CSRF Origin + CSP + rate-limit
│                                #   par utilisateur + gestionnaire d'erreurs central + Sentry
│
└── frontend/
    └── src/
        ├── components/
        │   ├── layout/          # Sidebar (role-based), Layout, Header (langue/thème)
        │   └── ui/              # Button, Badge, Table, Modal, Input, Select,
        │                        #   SearchInput, Pagination, ConfirmModal, PageHeader,
        │                        #   ProtectedRoute, NotificationBell
        ├── config/routes.ts     # routes de l'application + rôles autorisés (menu, palette, gardes)
        ├── hooks/               # useApi, useAuth, useTheme
        ├── i18n/fr|ar|en/       # common.json (~2 560 lignes, 2 308 clés ; les trois langues sont
        │                        #   synchronisées, garde-fou de traduction dans les tests)
        ├── pages/               # 27 dossiers de pages (dont CahierTexte, GestionPortail, Audit)
        │                        #   + Dashboard, Login, LandingPage ; Scanner (public,
        │                        #   sous Pointage/) et PortailParent (public)
        ├── lib/api.ts           # fetch wrapper (rafraîchit la session sur 401)
        └── store/               # authStore (Zustand + persist)
```

### Modèles Prisma (57)

**Établissement & référentiels**
`Etablissement` · `Filiere` · `Role` · `Utilisateur` · `Fonction` · `Niveau` · `Domaine` · `Tarif` · `ConfigNotes` · `Mention` · `MatriculeCounter`

**Personnel**
`Personnel` · `PersonnelCarte` · `Pointage` · `HeureTravail` · `PresencePersonnel` · `PaiementPersonnel` · `PersonnelMatiereClasse` · `DemandeAbsencePersonnel`

**Académique**
`AnneeScolaire` · `Matiere` · `Classe` · `ClasseMatiere` · `ClasseMatierePeriode`

**Cahier de texte**
`CahierSeance` · `Devoir` · `CahierVisa`

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

Chaque requête authentifiée extrait `etablissement_id` du JWT et les services filtrent par cet identifiant : `where: { id, etablissement_id }` (manuel, à chaque requête — pas encore de RLS PostgreSQL, voir la roadmap). Les accès par identifiant à des ressources d'un autre établissement répondent « introuvable ». Des tests d'intégration verrouillent les points sensibles : génération de documents (certificats, relevés, cartes, attestations de travail), saisie et lecture des notes, liste des scans du jour.

### Périmètre du professeur

Un **professeur ne voit et ne modifie que les classes où il est affecté** (table `PersonnelMatiereClasse`) et leurs élèves : classes, élèves (avec parents), notes, absences, bulletins, évaluations, cahier de texte, emploi du temps, exports et PDF. Hors périmètre → `404` (on ne révèle pas l'existence d'une classe ou d'un élève). La règle est centralisée dans `backend/src/utils/portee.ts` et vérifiée par `rbac/portee-professeur.itest.ts`. À la saisie des notes, l'affectation à la classe est toujours exigée ; le réglage « toutes les matières » (Paramètres) permet seulement d'étendre aux autres matières **de ses classes**. Un professeur sans affectation ne voit donc aucune classe : **les affectations sont à refaire à chaque rentrée** (la reconduction des classes ne les reprend pas).

### Rôles et accès (navigation)

Sept rôles, stockés en base (`Role.libelle_fr`) et centralisés dans `backend/src/config/roles.ts` (source unique pour les routes API) et `frontend/src/config/routes.ts` (menu, palette de commandes, gardes de pages).

| Rôle | Pages accessibles |
|------|------------------|
| `admin` | Toutes |
| `directeur` | Toutes sauf Finances, Utilisateurs et Paramètres |
| `conseiller pédagogique` | **Mêmes droits que le directeur** (toutes sauf Finances, Utilisateurs et Paramètres) |
| `gestionnaire` | Toutes sauf Utilisateurs, Paramètres et Audit |
| `agent de scolarité` | Dashboard, Élèves, Emploi du temps, Calendrier, Messagerie, Bibliothèque, Absences, Finances |
| `professeur` | Dashboard, Classes, Notes, Évaluations, Cahier de texte, Bulletins, Activités, Emploi du temps, Calendrier, Messagerie, Absences — **limité à ses classes** |
| `pointeur` | Dashboard, Emploi du temps, Calendrier, Messagerie, Absences, Pointage |

> Le module **Cahier de texte** est accessible à la direction, au conseiller pédagogique, au `gestionnaire` et au `professeur` (groupe `ACADEMIQUE`) ; le visa (verrouillage d'une période) est réservé à la direction (`admin`, `directeur`, `conseiller pédagogique`).

> Le journal d'audit (`/audit`) est réservé à la direction (admin, directeur, conseiller pédagogique) côté API et côté menu.

> Le **conseiller pédagogique** a été ajouté comme un rôle « semblable au directeur » : il figure dans chaque groupe où figure le directeur, y compris l'exclusion des finances ; un test (`rbac.test.ts`) vérifie la parité sur tous les groupes.

### Bulletins — filières et types

| Type | Description |
|------|-------------|
| `FR` / `AR` | Bulletin d'une filière (français / arabe) |
| `EN` | Filière anglaise pleinement prise en charge (service, moteur de calcul, templates `EN`/`ANNUEL_EN`) ; le sélecteur du front l'affiche automatiquement dès qu'une filière EN est active. Seul le rapport socle IEF ne la ventile pas (grille officielle à colonnes fixes — *par conception*, cf. Dette technique) |
| `COMBINE` | **Combiné au choix** : fusionne les filières choisies à la génération (`filieres_combine`, ex. FR+AR, FR+EN) ; repli sur les filières actives de l'élève |
| `ANNUEL` | Récapitulatif annuel des périodes (trimestres/semestres selon l'établissement) |

Points clés du calcul et du rendu :
- **Barème de saisie effectif** d'une matière : `ClasseMatierePeriode.note_max` > `ClasseMatiere.note_max_override` > `Matiere.note_max` > `ConfigNotes.note_max`. Les notes sont normalisées sur la base canonique de l'établissement avant le calcul des moyennes.
- **Échelle d'affichage** de la moyenne : portée par le **niveau** (`Niveau.note_max`, ex. primaire /10 et secondaire /20 dans le même établissement) ; repli sur `ConfigNotes.note_max`.
- **Mentions** : configurables par établissement, avec portée filière et/ou niveau (résolution : filière+niveau > filière > niveau > établissement).
- **Coefficients par période** : `ClasseMatierePeriode` permet de changer coefficient/barème/évaluée d'une matière entre le T1 et le T2 (fréquent en filière arabe).
- **Verrouillage de période** : un préflight contrôle l'état avant génération ; la direction peut déverrouiller une période.
- **Templates éditables** : un template HTML par type (FR/AR/COMBINE/ANNUEL), personnalisable par établissement, rendu par le moteur interne `microTemplate`.
- **Aperçu PDF** : le même PDF que le téléchargement s'affiche d'abord dans une modale (`iframe` sur blob) avant l'enregistrement — l'utilisateur vérifie le rendu sans quitter l'application.

### Cycle de vie des générations

Aucun fichier n'est stocké : chaque PDF est rendu à la volée (Puppeteer) à partir des données courantes ; seul `Bulletin.generated_at` trace la dernière génération. En conséquence, un bulletin peut devenir **périmé** si des notes ou le programme (coefficient/barème par période) changent après sa génération :

- **`GET /bulletins/etat`** calcule pour une classe/période/filière un statut `a_jour` · `perime` · `partiel` · `non_genere` (badge affiché sur la page Bulletins).
- **Régénération automatique** : toute saisie de notes (`POST /notes/bulk`) déclenche `regenererBulletinsImpactes()`, qui régénère uniquement les bulletins des élèves/matières/périodes touchés — **sauf les bulletins déjà signés/validés**, qui ne sont jamais écrasés silencieusement.
- **Nettoyage des orphelins** : un bulletin qui ne correspond plus à aucune note existante (élève désinscrit, matière retirée) est supprimé automatiquement lors de la régénération plutôt que de rester figé sur des données disparues.

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
- PostgreSQL 15+ (la production tourne sous PostgreSQL 18)

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
npx prisma migrate deploy

# Injecter les données de développement (admin + comptes de test)
npm run db:seed

# Démarrer
npm run dev            # http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # VITE_API_URL=http://localhost:3000
npm install
npm run dev            # http://localhost:5173
```

> Les deux serveurs doivent tourner simultanément.

> **Installation à neuf (base vierge)** : `npx prisma migrate deploy` puis `node prisma/seed-prod.cjs` créent l'établissement (nom, code des matricules et coordonnées via `ETABLISSEMENT_NOM`, `ETABLISSEMENT_CODE`, `ETABLISSEMENT_ADRESSE`, `ETABLISSEMENT_TELEPHONE`), les sept rôles, les niveaux, les fonctions, les domaines et le compte `admin`. Ce chemin est rejoué à chaque exécution de la CI.

---

## Variables d'environnement

Validées au démarrage par Zod (`src/config/env.ts`) — le serveur **refuse de démarrer** si une variable requise est absente ou invalide.

### `backend/.env`

| Variable | Description | Requis |
|----------|-------------|--------|
| `DATABASE_URL` | URL PostgreSQL (`postgresql://user:pass@host:5432/db`). En production, utiliser l'URL **privée** de la base (réseau interne Railway), jamais le proxy public | ✅ |
| `JWT_SECRET` | Clé secrète JWT — **min 32 caractères** | ✅ |
| `QR_SECRET` | Clé de signature HMAC des QR codes (cartes, pointage) — **min 32 caractères** | ✅ |
| `CORS_ORIGIN` | Origine(s) autorisée(s), séparées par des virgules | défaut `http://localhost:5173` |
| `COOKIE_DOMAIN` | Domaine du cookie httpOnly (ex: `.mon-ecole.sn`) ; un avertissement est émis au démarrage s'il est absent en production | prod |
| `PORT` | Port du serveur | défaut `3000` |
| `JWT_EXPIRES_IN` | Durée du jeton d'accès (la session se prolonge par le refresh token de 30 j) | défaut `1h` |
| `NODE_ENV` | `development` · `production` · `test` | défaut `development` |
| `SENTRY_DSN` | DSN Sentry — si absent, Sentry est désactivé (no-op) | — |
| `SENTRY_TRACES_SAMPLE_RATE` | Taux d'échantillonnage des traces (0–1) | défaut `0` |
| `PUPPETEER_EXECUTABLE_PATH` | Chemin Chrome/Chromium pour la génération PDF (défini dans l'image Docker) | — |
| `PDF_ATTENTE_MAX_MS` | Attente maximale d'une place dans la file de génération PDF (au-delà : `503`) | défaut `60000` |

Variables lues uniquement par le seed (`prisma/seed-prod.cjs`) :

| Variable | Description |
|----------|-------------|
| `ADMIN_INITIAL_PASSWORD` | Mot de passe initial du compte `admin`. Absent : un mot de passe **aléatoire** est généré et affiché **une seule fois** dans les logs du premier déploiement |
| `ETABLISSEMENT_NOM` · `ETABLISSEMENT_CODE` · `ETABLISSEMENT_ADRESSE` · `ETABLISSEMENT_TELEPHONE` | Établissement créé sur une base vierge (`code` = préfixe des matricules, unique ; défaut `FIC`) |

### `frontend/.env`

| Variable | Description | Défaut |
|----------|-------------|--------|
| `VITE_API_URL` | URL du backend (sans slash final). Passée en `ARG` au build Docker | `http://localhost:3000` |
| `VITE_SENTRY_DSN` | DSN Sentry côté navigateur (optionnel) | — |

---

## Comptes par défaut

> **Production** : aucun mot de passe par défaut. Le seed de production (`seed-prod.cjs`) ne crée que le compte `admin`, avec `ADMIN_INITIAL_PASSWORD` ou un mot de passe aléatoire affiché une fois dans les logs ; le **changement de mot de passe est obligatoire** à la première connexion. Les autres comptes sont créés par l'administrateur (page Utilisateurs / Personnel), chacun avec un mot de passe temporaire **différent** à lui transmettre en privé.

**Développement uniquement** (`npm run db:seed`, base locale jetable — ne jamais utiliser ces mots de passe ailleurs) :

| Identifiant | Mot de passe | Rôle |
|-------------|-------------|------|
| `admin` | `Admin123!` | Administrateur |
| `directeur` | `Directeur123!` | Directeur |
| `caissier` | `Caissier123!` | Agent de scolarité |
| `prof.fall` / `prof.diallo` / `prof.ahmed` / `prof.ndiaye` | `Prof123!` | Professeur |
| `pointeur` | `Pointeur123!` | Pointeur |

---

## Commandes disponibles

### Backend

```bash
npm run dev                  # Serveur en mode watch (tsx)
npm run build                # prisma generate + compilation TypeScript
npm start                    # migrate deploy + seed-prod + serveur compilé
npm test                     # Tests unitaires (Vitest, sans DB)
npm run test:integration     # Tests d'intégration (*.itest.ts, nécessite Postgres)
npm run test:watch           # Tests en mode watch
npm run test:coverage        # Rapport de couverture de code
npm run lint                 # ESLint        (lint:fix pour corriger)
npm run format               # Prettier      (format:check pour vérifier)
npm run db:migrate           # prisma migrate dev
npm run db:seed              # Seed de développement
npm run db:studio            # Interface Prisma Studio
npm run db:cleanup           # Nettoyage de données de développement
npm run db:migrate-matieres  # Migration des matières LGM (simulation) — :apply pour appliquer
```

### Frontend

```bash
npm run dev            # Serveur Vite
npm run build          # Type-check + build de production
npm run preview        # Prévisualiser le build
npm test               # Tests UI (Vitest + Testing Library)
```

---

## Déploiement

La production tourne sur **Railway** avec trois services : **PostgreSQL**, **API** (image `backend/Dockerfile`) et **front** (image `frontend/Dockerfile` : build Vite servi par nginx, repli SPA).

- **Déploiement continu** : chaque merge sur `main` déclenche le build des deux services. L'API exécute au démarrage `prisma migrate deploy` (les migrations s'appliquent donc toutes seules), puis le seed idempotent `seed-prod.cjs` (sans effet une fois les rôles et l'admin créés), puis le serveur.
- **Image API** : Node 20 Alpine + Chromium système (`PUPPETEER_EXECUTABLE_PATH`) pour les PDF.
- **Base de données** : l'API doit joindre PostgreSQL par le **réseau privé** (`*.railway.internal`) ; l'URL publique du proxy sert uniquement aux accès externes (sauvegarde, requêtes d'administration).
- **Santé** : `GET /health` (base + moteur PDF) ; l'état des services se lit dans Railway.
- **Variables de production** : `DATABASE_URL`, `JWT_SECRET`, `QR_SECRET`, `CORS_ORIGIN`, `COOKIE_DOMAIN`, `NODE_ENV=production`, `JWT_EXPIRES_IN=1h`, `SENTRY_DSN` (optionnel) ; côté front, `VITE_API_URL` (argument de build).
- **Sauvegarde** : `pg_dump` avec un client de version **identique ou supérieure** à celle du serveur (PostgreSQL 18 en production — un `pg_dump` plus ancien refuse de se connecter). Faire une sauvegarde avant toute opération destructive ou toute création d'année scolaire en masse.
- **Migrations** : ne jamais éditer une migration déjà appliquée ; en ajouter une (voir [`backend/prisma/migrations/README.md`](backend/prisma/migrations/README.md)).

---

## Scripts de maintenance et d'import

Hors de l'application, `backend/prisma/` contient des scripts ponctuels, lancés à la main avec `tsx` contre une base précise (ils ne font **pas** partie du démarrage) :

| Dossier / fichier | Rôle |
|-------------------|------|
| `lgm/` (+ `lgm/prod/`) | Migration de l'ancienne application LGM vers DaaraGest, par phases numérotées : configuration (échelle /10, mentions, années 2024-2025 et 2025-2026, niveaux), classes, matières, programme, élèves, notes, validation. Idempotent, simulation par défaut (`--apply` pour écrire) |
| `migrate-matieres-lgm.ts` | Applique le référentiel LGM (6 domaines, 76 matières) sur une base déployée. **L'étape 3 supprime** les matières absentes du référentiel ; simulation par défaut, `--apply` pour écrire |
| `personnel-ficaam/` · `data/personnel-ficaam*.csv` | Import historique du personnel d'un établissement (comptes professeur + fiches, détails, validation) |
| `backfill-classe-code.ts` | Renseigne `Classe.code` pour les classes créées avant la migration — simulation par défaut, `--apply` |
| `complete-affectations-classe.ts` | Étend les affectations d'enseignants à toutes les matières de la classe — simulation par défaut, `--apply` |
| `cleanup.ts` | **Supprime toutes les données de test** (conserve établissement, rôles, config des notes, admin, matières) — `npm run db:cleanup` ; destiné aux bases de développement/recette |

> Ce sont des scripts **historiques, propres à un établissement**, dont certains sont destructifs : à relire avant toute réutilisation, à exécuter d'abord sur une copie de la base, et à ne jamais lancer en production sans sauvegarde préalable (et, pour `cleanup.ts`, jamais sur une base qui contient de vraies données).

---

## API Reference

Préfixe : `/api/v1`. L'authentification se fait par cookie httpOnly (ou `Authorization: Bearer <token>` pour un client API). **Seules routes publiques** : `GET /health`, `POST /auth/login`, `POST /auth/refresh`, `GET /portail-parent/acces/:token` (+ PDF d'un bulletin) et `POST /pointage/scan` (borne de pointage, QR signé HMAC).

La colonne **Accès** reprend les groupes de `backend/src/config/roles.ts` (source unique, verrouillée par `rbac.test.ts`) :

| Accès | Rôles autorisés |
|---|---|
| **Public** | aucune session |
| Session | toute session valide |
| Tous | admin, directeur, conseiller pédagogique, gestionnaire, agent de scolarité, professeur, pointeur |
| Pédagogie | admin, directeur, conseiller pédagogique, gestionnaire, professeur |
| Scolarité | admin, directeur, conseiller pédagogique, gestionnaire, agent de scolarité |
| Gestion | admin, directeur, conseiller pédagogique, gestionnaire |
| Direction | admin, directeur, conseiller pédagogique |
| Finances | admin, gestionnaire, agent de scolarité — **jamais** le directeur ni le conseiller pédagogique |
| Finances (gestion) | admin, gestionnaire |
| Admin | admin seul |

> **Professeur** : sur les routes qui lui sont ouvertes, il ne voit et ne modifie que les **classes où il est affecté** (et leurs élèves) ; hors périmètre, la réponse est `404`. Une session dont le mot de passe doit être changé reçoit `403` partout sauf `/auth/change-password`, `/auth/me` et `/auth/logout`.

> Erreurs : entrée invalide → `400` (champ + raison) ; hors périmètre / inexistant → `404` ; trop de requêtes → `429` ; génération de PDF saturée → `503` ; tout le reste → `500 « Erreur interne du serveur »` sans détail.

### Santé

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/health` | **Public** | État de la base et du moteur PDF (`200` ok · `207` PDF dégradé · `503` base injoignable) — hors préfixe `/api/v1` |

### Auth

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `POST` | `/auth/login` | **Public** | Connexion · limitée à 10 essais/min par couple (IP, identifiant) et 30 échecs/10 min par IP · verrouillage **progressif** du compte (1 → 5 → 15 → 60 min) · pose les cookies httpOnly |
| `POST` | `/auth/refresh` | **Public** | Renouveler le jeton d'accès via le refresh token (cookie) · 10 req/min · l'ancien refresh token garde 60 s de grâce (plusieurs onglets) · refusé si le compte est désactivé |
| `POST` | `/auth/logout` | Session | Déconnexion + révocation du refresh token de l'appareil |
| `GET` | `/auth/me` | Session | Profil connecté (dont `must_change_password`) |
| `PUT` | `/auth/change-password` | Session | Changer le mot de passe (le nouveau doit différer de l'ancien) · révoque les autres sessions et rouvre celle de l'appareil |
| `PUT` | `/auth/profil` | Session | Mettre à jour nom, langue, thème |
| `DELETE` | `/auth/sessions` | Session | Révoquer toutes ses sessions (jetons d'accès et de rafraîchissement) |

### Années scolaires

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/annees-scolaires` | Session | Liste |
| `POST` | `/annees-scolaires` | Gestion | Créer |
| `PUT` | `/annees-scolaires/:id` | Gestion | Modifier |
| `PUT` | `/annees-scolaires/:id/activer` | Gestion | Définir comme active |
| `DELETE` | `/annees-scolaires/:id` | Admin | Supprimer |

### Filières

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/filieres` | Tous | Liste des filières de l'établissement |
| `POST` | `/filieres` | Gestion | Créer (gestion) |
| `PATCH` | `/filieres/:id` | Gestion | Modifier |
| `DELETE` | `/filieres/:id` | Gestion | Supprimer (garde exhaustive des données liées) |

### Niveaux

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/niveaux` | Tous | Liste (avec échelle d'affichage `note_max` et groupe de grille IEF) |
| `POST` | `/niveaux` | Admin | Créer |
| `PUT` | `/niveaux/:id` | Admin | Modifier |
| `DELETE` | `/niveaux/:id` | Admin | Supprimer |

### Domaines pédagogiques

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/domaines` | Pédagogie | Liste |
| `POST` | `/domaines` | Gestion | Créer (gestion) |
| `PUT` | `/domaines/:id` | Gestion | Modifier |
| `DELETE` | `/domaines/:id` | Admin | Supprimer (admin) |

### Matières

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/matieres?filiere=` | Pédagogie | Liste (filtrable par filière) |
| `POST` | `/matieres` | Gestion | Créer |
| `PUT` | `/matieres/:id` | Gestion | Modifier |
| `DELETE` | `/matieres/:id` | Admin | Désactiver |

### Mentions

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/mentions` | Gestion | Liste |
| `POST` | `/mentions` | Gestion | Créer (gestion) |
| `PATCH` | `/mentions/:id` | Gestion | Modifier |
| `DELETE` | `/mentions/:id` | Gestion | Supprimer (la mention système « Insuffisant » est protégée) |

### Tarifs

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/tarifs` | Gestion | Catalogue des tarifs |
| `POST` | `/tarifs` | Admin | Créer (admin) |
| `PATCH` | `/tarifs/:id` | Admin | Modifier (admin) |
| `DELETE` | `/tarifs/:id` | Admin | Supprimer (admin) |

### Fonctions (personnel)

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/fonctions` | Gestion | Liste des fonctions configurées |
| `POST` | `/fonctions` | Gestion | Créer (gestion) |
| `PATCH` | `/fonctions/:id` | Gestion | Modifier |
| `DELETE` | `/fonctions/:id` | Gestion | Supprimer (fonctions par défaut protégées) |

### Classes

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/classes?annee_scolaire_id=` | Pédagogie | Liste (un professeur ne voit que ses classes) |
| `POST` | `/classes` | Gestion | Créer |
| `POST` | `/classes/reconduire` | Gestion | **Reconduction** des classes d'une année vers une autre (toutes ou une sélection ; avec ou sans le programme de matières ; `apercu: true` = simulation) — jamais d'affectations, élèves ni emploi du temps |
| `GET` | `/classes/pdf-toutes-classes` | Pédagogie | Listes de toutes les classes en PDF |
| `GET` | `/classes/:id` | Pédagogie | Détail |
| `PUT` | `/classes/:id` | Gestion | Modifier |
| `PUT` | `/classes/:id/programme-mode` | Gestion | Programme identique toute l'année ou différent par période |
| `DELETE` | `/classes/:id` | Admin | Supprimer |
| `GET` | `/classes/:id/eleves` | Pédagogie | Élèves de la classe |
| `POST` | `/classes/:id/dupliquer` | Gestion | Dupliquer (vers une autre filière) |
| `GET` | `/classes/:id/pdf-liste` | Pédagogie | Liste de classe en PDF |
| `GET` | `/classes/:id/matieres` | Pédagogie | Matières de la classe (coeff/barème effectifs) |
| `POST` | `/classes/:id/matieres` | Gestion | Rattacher une matière |
| `PUT` | `/classes/:id/matieres/:matiere_id` | Gestion | Overrides classe (coeff, barème, évaluée) |
| `DELETE` | `/classes/:id/matieres/:matiere_id` | Gestion | Détacher |
| `PUT` | `/classes/:id/matieres/:matiere_id/periode` | Gestion | Override spécifique à une période |
| `DELETE` | `/classes/:id/matieres/:matiere_id/periode/:periode` | Gestion | Retirer l'override de période |

### Élèves

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/eleves?page&search&classe_id&actif&limit` | Tous | Liste paginée (`limit` plafonné à 200 ; un professeur ne voit que les élèves de ses classes) |
| `GET` | `/eleves/export-excel` | Tous | Export Excel |
| `POST` | `/eleves` | Scolarité | Créer (matricule auto `CODE-E-YY-NNN`) |
| `POST` | `/eleves/import` | Scolarité | Import CSV · body `{ rows[] }` · max 500 · retourne `{ created, errors[] }` |
| `POST` | `/eleves/bulk-desactiver` | Admin | Désactivation en masse (admin) |
| `POST` | `/eleves/bulk-supprimer` | Admin | **Suppression définitive** en masse (admin) |
| `POST` | `/eleves/bulk-inscrire` | Scolarité | Inscription en masse dans une classe |
| `GET` | `/eleves/:id` | Tous | Détail + parents + inscriptions |
| `GET` | `/eleves/:id/progression` | Tous | Progression de l'élève |
| `PUT` | `/eleves/:id` | Scolarité | Modifier |
| `DELETE` | `/eleves/:id` | Admin | **Suppression définitive** (admin, cascade contrôlée) |
| `PATCH` | `/eleves/:id/toggle-actif` | Scolarité | Activer/désactiver |
| `POST` | `/eleves/:id/inscrire` | Scolarité | Inscrire dans une classe (par filière) |
| `PATCH` | `/eleves/:id/transferer` | Scolarité | Transfert de classe en cours d'année |
| `GET` | `/eleves/:id/qr` | Tous | QR code de la carte élève |

### Personnel

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/personnel?page&search&limit` | Tous | Liste paginée |
| `GET` | `/personnel/:id` | Tous | Détail |
| `POST` | `/personnel` | Gestion | Créer (utilisateur + profil liés) |
| `PUT` | `/personnel/:id` | Gestion | Modifier |
| `DELETE` | `/personnel/:id` | Admin | Désactiver (soft-delete) |
| `GET` | `/personnel/:id/affectations` | Tous | Affectations matière×classe |
| `POST` | `/personnel/:id/affectations` | Gestion | Affecter à une classe/matière |
| `DELETE` | `/personnel/:id/affectations/:classe_id` | Gestion | Retirer une affectation |

### Notes

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/notes?classe_id&matiere_id&periode&annee_scolaire_id` | Pédagogie | Liste (bornée à l'établissement ; un professeur ne voit que les notes de ses classes) |
| `POST` | `/notes/bulk` | Pédagogie | Upsert en masse — valide contre le barème effectif ; un professeur doit enseigner dans la classe de chaque élève (même sans `classe_id`) ; élèves, matières et années doivent appartenir à l'établissement |
| `POST` | `/notes/bulk-supprimer` | Gestion | Suppression en masse |
| `GET` | `/notes/eleve/:eleve_id` | Pédagogie | Notes d'un élève |

### Bulletins

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/bulletins?annee_scolaire_id&periode&filiere&eleve_id` | Pédagogie | Liste |
| `POST` | `/bulletins/preflight` | Pédagogie | Contrôles avant génération (matières sans notes, période verrouillée…) |
| `GET` | `/bulletins/etat?classe_id&periode&annee_scolaire_id&filiere` | Pédagogie | État de génération de la classe/période : `a_jour` · `perime` · `partiel` · `non_genere` |
| `POST` | `/bulletins/deverrouiller-periode` | Direction | Déverrouiller une période (direction) |
| `POST` | `/bulletins/generer` | Pédagogie | Générer les bulletins d'une période (FR · AR · EN · COMBINE, `filieres_combine` au choix) |
| `POST` | `/bulletins/generer-annuel` | Pédagogie | Générer l'annuel (periode=0) |
| `GET` | `/bulletins/pdf-classe?classe_id&periode&filiere` | Pédagogie | PDF toute une classe |
| `GET` | `/bulletins/template/:type` | Pédagogie | Template du bulletin (personnalisé ou défaut) |
| `PUT` | `/bulletins/template/:type` | Direction | Créer/modifier le template (direction) |
| `DELETE` | `/bulletins/template/:type/reset` | Direction | Réinitialiser au template par défaut (direction) |
| `POST` | `/bulletins/template/:type/apercu` | Pédagogie | Aperçu HTML du template |
| `GET` | `/bulletins/:id` | Pédagogie | Détail avec notes par filière |
| `PATCH` | `/bulletins/:id/observation` | Pédagogie | Saisir l'observation du conseil/professeur |
| `GET` | `/bulletins/:id/pdf` | Pédagogie | PDF individuel (Puppeteer) |

### Absences élèves

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/absences/jour` | Tous | Absences du jour par classe |
| `GET` | `/absences?classe_id&date&eleve_id&page` | Tous | Liste paginée |
| `POST` | `/absences` | Tous | Saisie individuelle |
| `POST` | `/absences/bulk` | Tous | Saisie groupée (déclenche alerte si ≥ seuil) |
| `GET` | `/absences/stats` | Tous | Statistiques |
| `GET` | `/absences/eleve/:id` | Tous | Absences d'un élève |

### Emploi du temps

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/emploi-du-temps?classe_id&annee_scolaire_id` | Tous | Créneaux par classe |
| `POST` | `/emploi-du-temps` | Gestion | Créer un créneau (valide jour actif + conflits) |
| `PUT` | `/emploi-du-temps/:id` | Gestion | Modifier |
| `DELETE` | `/emploi-du-temps/:id` | Gestion | Supprimer |

### Calendrier scolaire

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/calendrier?annee_scolaire_id&mois&annee` | Tous | Événements |
| `POST` | `/calendrier` | Gestion | Créer un événement |
| `PUT` | `/calendrier/:id` | Gestion | Modifier |
| `DELETE` | `/calendrier/:id` | Gestion | Supprimer |

### Notifications

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/notifications` | Session | Notifications non lues de l'utilisateur courant |
| `PUT` | `/notifications/:id/lue` | Session | Marquer une notification comme lue |
| `PUT` | `/notifications/lire-toutes` | Session | Marquer toutes comme lues |

### Messagerie

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/messagerie` | Tous | Liste des conversations + indicateur non-lus |
| `POST` | `/messagerie` | Tous | Créer une conversation (individuelle ou broadcast par rôle) |
| `GET` | `/messagerie/utilisateurs` | Tous | Destinataires possibles |
| `GET` | `/messagerie/:id` | Tous | Messages d'une conversation (marque comme lue) |
| `POST` | `/messagerie/:id/messages` | Tous | Envoyer un message |

### Portail parent

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/portail-parent/acces/:token` | **Public** | Données complètes de l'élève (notes, paiements, absences, devoirs) — refusé si le lien a expiré |
| `GET` | `/portail-parent/acces/:token/bulletin/:bulletin_id/pdf` | **Public** | Bulletin PDF de l'élève |
| `GET` | `/portail-parent` | Gestion | Lister tous les tokens de l'établissement (actif/révoqué/expiré) — alimente l'écran dédié « Gestion du portail » |
| `POST` | `/portail-parent/generer` | Gestion | Générer le lien du portail d'un élève (ou le réutiliser) — expiration auto à la fin de l'année active ; tracé dans l'audit (`PORTAIL_GENERATE`) |
| `POST` | `/portail-parent/regenerer` | Gestion | Faire tourner le lien d'un élève (nouveau jeton, l'ancien cesse de fonctionner) |
| `DELETE` | `/portail-parent/:token/revoquer` | Gestion | Révoquer un lien (tracé dans l'audit, `PORTAIL_REVOKE`) |

### Finances

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/finances/paiements-eleves?page&search&type&statut&mois&annee` | Finances | Liste paginée |
| `POST` | `/finances/paiements-eleves` | Finances | Créer (numéro de reçu auto `REC-AAAAMMJJ-NNNNNN`) |
| `POST` | `/finances/paiements-eleves/bulk` | Finances | Saisie en masse |
| `GET` | `/finances/paiements-eleves/:id/recu` | Finances | **Reçu de paiement** individuel en PDF A5 (établissement, élève, classe, motif, montant, signatures) |
| `PUT` | `/finances/paiements-eleves/:id` | Admin | Modifier |
| `DELETE` | `/finances/paiements-eleves/:id` | Admin | Supprimer |
| `GET` | `/finances/paiements-personnel?page&mois&annee` | Finances (gestion) | Paiements du personnel (alias legacy : `/paiements-professeurs`) |
| `POST` | `/finances/paiements-personnel` | Finances (gestion) | Créer |
| `GET` | `/finances/paiements-professeurs` | Finances (gestion) | Alias historique de `/paiements-personnel` (à supprimer quand plus aucun client ne l'utilise) |
| `POST` | `/finances/paiements-professeurs` | Finances (gestion) | Alias historique de `POST /paiements-personnel` |
| `GET` | `/finances/export-excel` · `/export-pdf` | Finances | Exports des paiements |
| `GET` | `/finances/export-pdf` | Finances | Export PDF des paiements (mêmes filtres que l'export Excel) |
| `GET` | `/finances/stats` | Finances | Stats du mois courant |
| `GET` | `/finances/reliquats?mois&annee&annee_scolaire_id` | Finances | Élèves sans mensualité pour la période |
| `GET` | `/finances/reliquats/export-excel` · `/reliquats/export-pdf` | Finances | Exports des reliquats |
| `GET` | `/finances/reliquats/export-pdf` | Finances | Export PDF des reliquats |
| `GET` | `/finances/stats-mensuels?nb_mois=6` | Finances | Encaissements des N derniers mois |

### Pointage

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/pointage?mois&annee&statut&professeur_id&page` | Tous | Historique paginé |
| `GET` | `/pointage/jour?date=YYYY-MM-DD` | Tous | Personnel actif + présence du jour |
| `POST` | `/pointage` | Tous | Upsert individuel |
| `POST` | `/pointage/bulk` | Tous | Saisie groupée d'une journée |
| `GET` | `/pointage/stats?mois&annee` | Tous | Stats par personnel (taux de présence) |
| `GET` | `/pointage/qr/:personnelId` | Gestion | QR code signé du personnel |
| `POST` | `/pointage/qr/:personnelId/regenerer` | Gestion | Régénérer le QR (révoque l'ancien) |
| `POST` | `/pointage/scan` | **Public** | Scan d'un QR signé HMAC par la borne → pointage `source='qr'` (public par conception) |
| `GET` | `/pointage/scans-jour` | Tous | Scans QR du jour pour la page Scanner — **session obligatoire**, établissement tiré du jeton, nom et prénom seulement |

### Demandes d'absence personnel

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/demandes-absence-personnel` | Gestion | Liste (gestion) |
| `POST` | `/demandes-absence-personnel` | Gestion | Créer une demande |
| `PATCH` | `/demandes-absence-personnel/:id/traiter` | Gestion | Approuver/refuser |
| `DELETE` | `/demandes-absence-personnel/:id` | Gestion | Supprimer |

### Évaluations formatives

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/evaluations?classe_id&matiere_id&periode&annee_scolaire_id` | Pédagogie | Liste |
| `POST` | `/evaluations` | Pédagogie | Créer une évaluation |
| `PUT` | `/evaluations/:id` | Pédagogie | Modifier |
| `DELETE` | `/evaluations/:id` | Direction | Supprimer (direction) |
| `GET` | `/evaluations/moyenne?classe_id&matiere_id&periode` | Pédagogie | Moyenne pondérée |
| `GET` | `/evaluations/:id/notes` | Pédagogie | Notes d'une évaluation |
| `POST` | `/evaluations/:id/notes/bulk` | Pédagogie | Saisie en masse des notes |

### Cahier de texte

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/cahier/journee?date&annee_scolaire_id` | Pédagogie | Séances et créneaux du jour (vue « Ma journée ») |
| `GET` | `/cahier/seances?classe_id&annee_scolaire_id&du&au` | Pédagogie | Séances faites sur un intervalle |
| `POST` | `/cahier/seances` | Pédagogie | Créer/mettre à jour une séance (contenu, objectif) — depuis un créneau ou libre |
| `PATCH` | `/cahier/seances/:id` | Pédagogie | Modifier une séance |
| `DELETE` | `/cahier/seances/:id` | Pédagogie | Supprimer une séance |
| `GET` | `/cahier/devoirs?classe_id&annee_scolaire_id&du&au` | Pédagogie | Devoirs à faire sur un intervalle (`pour_le`) |
| `POST` | `/cahier/devoirs` | Pédagogie | Créer un devoir (leçon/exercice/récitation/autre) |
| `PATCH` | `/cahier/devoirs/:id` | Pédagogie | Modifier |
| `DELETE` | `/cahier/devoirs/:id` | Pédagogie | Supprimer |
| `GET` | `/cahier/completude` | Pédagogie | Indicateur prévu vs. renseigné (créneaux avec/sans séance saisie) |
| `GET` | `/cahier/export-pdf` | Pédagogie | Export PDF du cahier (inspection) |
| `GET` | `/cahier/visas` | Pédagogie | Liste des visas (périodes verrouillées par la direction) |
| `POST` | `/cahier/visas` | Direction | Viser un intervalle `[du, au]` d'une classe — verrouille la saisie (direction) |
| `DELETE` | `/cahier/visas/:id` | Direction | Retirer un visa (direction) |

### Activités parascolaires

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/activites` | Scolarité | Liste des activités |
| `POST` | `/activites` | Scolarité | Créer une activité |
| `PUT` | `/activites/:id` | Scolarité | Modifier |
| `DELETE` | `/activites/:id` | Direction | Supprimer (direction) |
| `GET` | `/activites/:id/inscriptions` | Scolarité | Élèves inscrits |
| `POST` | `/activites/:id/inscriptions` | Scolarité | Inscrire un élève |
| `DELETE` | `/activites/:id/inscriptions/:eleve_id` | Scolarité | Désinscrire |
| `GET` | `/activites/:id/seances` | Scolarité | Séances de l'activité |
| `POST` | `/activites/:id/seances` | Scolarité | Créer une séance |
| `DELETE` | `/activites/:id/seances/:seance_id` | Scolarité | Supprimer une séance |
| `GET` | `/activites/:id/seances/:seance_id/presences` | Scolarité | Présences à une séance |
| `POST` | `/activites/:id/seances/:seance_id/presences/bulk` | Scolarité | Saisie présences en masse |
| `POST` | `/activites/inscriptions/:inscription_id/evaluation` | Scolarité | Évaluer un élève |

### Progression pluriannuelle

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/progression` | Scolarité | Liste des progressions |
| `POST` | `/progression/generer` | Direction | Générer / mettre à jour les progressions |
| `PUT` | `/progression/:id/valider` | Direction | Valider une progression (direction) |

### Documents officiels

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `POST` | `/documents/generer-lot` | Gestion | Générer un lot de cartes PDF (CARTE_ELEVE · CARTE_PROFESSEUR) |
| `GET` | `/documents` | Gestion | Lister les templates disponibles (25 types) |
| `GET` | `/documents/historique?skip&take` | Gestion | Historique des documents générés |
| `POST` | `/documents/generer` | Gestion | Générer un document PDF |
| `POST` | `/documents/apercu` | Gestion | Aperçu HTML d'une carte (sans PDF ni historique) |
| `GET` | `/documents/:type` | Gestion | Récupérer un template (personnalisé ou défaut) |
| `PUT` | `/documents/:type` | Direction | Créer ou modifier un template personnalisé (direction) |
| `DELETE` | `/documents/:type/reset` | Direction | Réinitialiser au template par défaut (direction) |

### Statistiques analytiques

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/stats/tableau-de-bord` | Direction | KPIs direction : présences, moyennes, top/bottom élèves, alertes actives |

### Rapports

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/rapports/presences-eleves?classe_id&periode&annee_scolaire_id` | Gestion | Rapport présences élèves |
| `GET` | `/rapports/presences-personnel` | Gestion | Rapport présences personnel (alias legacy : `/presences-professeurs`) |
| `GET` | `/rapports/presences-professeurs` | Gestion | Alias historique de la route `…-personnel` |
| `GET` | `/rapports/resultats-classe?classe_id&periode&annee_scolaire_id` | Gestion | Résultats par classe |
| `GET` | `/rapports/bilan-financier?mois&annee` | Finances (gestion) | Bilan financier |
| `GET` | `/rapports/grille-ief` | Gestion | Grille officielle IEF |
| `GET` | `/rapports/grille-performance` | Gestion | Grille de performance |
| `GET` | `/rapports/performance-domaine` | Gestion | Performance par domaine pédagogique |
| `GET` | `/rapports/releve-notes` | Gestion | Relevé de notes |
| `GET` | `/rapports/propositions-fin` | Direction | Propositions de fin d'année |
| `GET` | `/rapports/charges-personnel` | Finances (gestion) | Charges du personnel |
| `GET` | `/rapports/apercu/presences-eleves` | Gestion | Aperçu HTML du rapport |
| `GET` | `/rapports/apercu/presences-personnel` | Gestion | Aperçu HTML du rapport |
| `GET` | `/rapports/apercu/presences-professeurs` | Gestion | Aperçu HTML du rapport |
| `GET` | `/rapports/apercu/resultats-classe` | Gestion | Aperçu HTML du rapport |
| `GET` | `/rapports/apercu/bilan-financier` | Finances (gestion) | Aperçu HTML du rapport |
| `GET` | `/rapports/apercu/grille-ief` | Gestion | Aperçu HTML du rapport |
| `GET` | `/rapports/apercu/grille-performance` | Gestion | Aperçu HTML du rapport |
| `GET` | `/rapports/apercu/performance-domaine` | Gestion | Aperçu HTML du rapport |
| `GET` | `/rapports/apercu/releve-notes` | Gestion | Aperçu HTML du rapport |
| `GET` | `/rapports/apercu/propositions-fin` | Direction | Aperçu HTML du rapport |
| `GET` | `/rapports/apercu/charges-personnel` | Finances (gestion) | Aperçu HTML du rapport |

### Audit

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/audit` | Direction | Journal d'audit filtrable (action, type, personne, période) ; chaque entrée contient une **phrase** (`phrase.cle` + `phrase.params`) avec les noms résolus |
| `GET` | `/audit/acteurs` | Direction | Personnes apparaissant dans le journal (filtre « Qui ») |
| `GET` | `/audit/entites` | Direction | Types de données présents dans le journal |

### Bibliothèque

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/bibliotheque/livres` | Scolarité | Catalogue des livres |
| `POST` | `/bibliotheque/livres` | Gestion | Ajouter un livre |
| `PUT` | `/bibliotheque/livres/:id` | Gestion | Modifier un livre |
| `DELETE` | `/bibliotheque/livres/:id` | Direction | Supprimer (admin/directeur) |
| `GET` | `/bibliotheque/emprunts` | Scolarité | Liste des emprunts |
| `POST` | `/bibliotheque/emprunts` | Scolarité | Créer un emprunt |
| `PUT` | `/bibliotheque/emprunts/:id/retour` | Scolarité | Enregistrer un retour |
| `GET` | `/bibliotheque/emprunts/en-retard` | Gestion | Emprunts en retard |

### Paramètres

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/parametres` | Admin | Établissement + config notes (admin) |
| `PUT` | `/parametres` | Admin | Modifier l'établissement |
| `GET` | `/parametres/notes` | Admin | Config notes (échelle, périodes, seuils, `jours_cours`, rendu bulletins…) |
| `PUT` | `/parametres/notes` | Admin | Modifier la config |
| `GET` | `/parametres/notes/politique` | Session | Politique de saisie des notes applicable à l'utilisateur courant |
| `GET` | `/parametres/notifications` | Admin | Préférences de notifications de l'établissement |
| `PUT` | `/parametres/notifications` | Admin | Modifier les préférences |

### Utilisateurs

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/utilisateurs/roles` | Session | Liste des rôles (depuis la DB) |
| `GET` | `/utilisateurs?page&search&role` | Admin | Liste paginée |
| `POST` | `/utilisateurs` | Admin | Créer |
| `PUT` | `/utilisateurs/:id` | Admin | Modifier |
| `DELETE` | `/utilisateurs/:id` | Admin | Désactiver |
| `DELETE` | `/utilisateurs/:id/definitif` | Admin | Suppression définitive |
| `PUT` | `/utilisateurs/:id/reactiver` | Admin | Réactiver |
| `PUT` | `/utilisateurs/:id/reset-password` | Admin | Réinitialiser le mot de passe |

---

## Modules

### Workflow typique en début d'année

1. **Paramètres** — Vérifier l'établissement (code matricule, devise), les filières actives, les tarifs, les jours de cours et la config des notes (nombre et noms des périodes : trimestres ou semestres)
2. **Années scolaires** — Créer l'année (ex: "2025-2026") et l'activer
3. **Niveaux & Domaines** — Vérifier les niveaux (échelle d'affichage, grille IEF) et les domaines pédagogiques
4. **Matières** — Vérifier/ajouter les matières par filière avec coefficients et barèmes
5. **Classes** — Créer les classes, ou les **reconduire** depuis l'année précédente (Années scolaires → « Reconduire les classes », voir plus bas) ; rattacher les matières (overrides par classe/période si besoin)
6. **Élèves** — Ajouter manuellement ou **importer via CSV** (matricule auto `CODE-E-YY-NNN`), inscrire dans les classes par filière
7. **Personnel** — Créer les comptes du personnel et **affecter chaque professeur à ses classes** (indispensable : un professeur sans affectation ne voit aucune classe, et les affectations ne sont pas reprises par la reconduction)
8. **Emploi du temps** — Saisir les créneaux par classe
9. **Calendrier scolaire** — Enregistrer les vacances et examens
10. **Notes → Bulletins → Finances → Pointage** au fil de l'année

### Reconduction des classes (rentrée)

Page **Années scolaires** → bouton **Reconduire les classes** sur la ligne de l'année cible :

1. Choisir l'année **source** (la précédente est proposée) : l'aperçu liste les classes actives et indique celles qui existent déjà dans l'année cible (cases grisées, jamais écrasées).
2. Cocher toutes les classes ou seulement une sélection.
3. Choisir le contenu repris : **structure + matières** (matières de chaque classe avec coefficients, barèmes, « évaluée » et réglages par période) ou **structure seule** (nom, filière, niveau, capacité) pour définir un nouveau programme.
4. Confirmer. Rien n'est repris côté **affectations d'enseignants, élèves, inscriptions, emploi du temps, notes ni cahier de texte** : l'équipe et les effectifs changent d'une année à l'autre. L'opération est idempotente (une classe de même filière et de même nom n'est jamais dupliquée) et tracée dans le journal d'audit.

### Reçu de paiement

Chaque paiement élève reçoit un numéro de reçu automatique (`REC-AAAAMMJJ-NNNNNN`, séquence PostgreSQL `seq_recu_numero`). Le bouton **Reçu** (liste des paiements) ouvre un **PDF A5** à remettre au parent : établissement (logo, adresse, téléphone), numéro de reçu, élève, matricule, classe, année, motif, période, date, montant, zones de signature du parent et de cachet.

### Journal d'audit

Page réservée à la direction (menu Sécurité). Chaque ligne est une **phrase** compréhensible (« Ibrahima Ba a changé Moussa Diop de classe : CM1 A → CM1 B ») : le backend résout les noms (élève, classe, matière, année, compte…) et renvoie une clé de phrase + paramètres, traduits FR/AR/EN par le front ; un élément supprimé depuis s'affiche « (supprimé depuis) », jamais un identifiant technique. Filtres : personne, type d'action (ajout, modification, suppression, mot de passe réinitialisé, décision de passage…), type de donnée, période (raccourcis aujourd'hui / 7 / 30 jours). Une erreur de chargement est signalée clairement (avec « Réessayer »).

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

### Cahier de texte

Journal de classe quotidien, pensé pour rester au plus près du geste du professeur en salle :

1. **Ma journée** — vue du jour alignée sur l'emploi du temps : chaque créneau de la classe/matière propose de saisir directement la séance faite (contenu, objectif) ; une séance peut aussi être créée hors créneau
2. **Devoirs à faire** — leçon, exercice, récitation ou autre, avec date de remise (`pour_le`) distincte de la date de saisie (`donne_le`) ; visibles par le parent dans l'onglet Devoirs du portail
3. **Complétude** — indicateur « prévu vs renseigné » : nombre de créneaux de la période effectivement couverts par une séance saisie
4. **Visa de la direction** — la direction vise un intervalle `[du, au]` d'une classe, ce qui **verrouille la saisie** sur cette période (comme le verrouillage de période des bulletins)
5. **Export PDF** — cahier imprimable pour l'inspection académique

### Portail parents

Le portail parent est accessible via un lien unique sans création de compte :

1. Page **Élèves** → cliquer l'icône portail sur la ligne de l'élève, ou l'écran dédié **Gestion du portail** (liste de tous les liens de l'établissement, recherche, statut actif/révoqué/expiré)
2. Cliquer **Générer le lien** → un UUID est créé, ou **tourné** (rotation : nouveau token, l'ancien devient invalide) s'il en existait déjà un
3. Copier et partager le lien via WhatsApp ou SMS
4. Le parent voit les **notes par période**, **paiements**, **absences**, **devoirs (cahier de texte)**, **informations de l'élève** et peut **télécharger** ou **prévisualiser les bulletins PDF**
5. Le lien **expire automatiquement** à la fin de l'année scolaire active (repli sur une durée fixe si aucune année active) ; l'admin/direction/gestionnaire peut aussi le révoquer à tout moment
6. Chaque génération et révocation est tracée dans le journal d'audit (`PORTAIL_GENERATE` / `PORTAIL_REVOKE`)

### Messagerie interne

- **Individuelle** : envoyer à un ou plusieurs utilisateurs nommément
- **Broadcast** : envoyer à un ou plusieurs rôles (ex: tous les professeurs)
- Messages classés du plus ancien au plus récent dans le fil
- Indicateur non-lus sur la liste de conversations
- Raccourci **Ctrl+Enter** pour envoyer

### Alertes automatiques (notifications)

| Déclencheur | Destinataires |
|-------------|---------------|
| Élève atteint N × `seuil_absences_alerte` absences non-justifiées | admin, directeur, conseiller pédagogique, gestionnaire |
| Professeur marqué absent | admin, directeur, conseiller pédagogique |

---

## Sécurité

| Mesure | Détail |
|--------|--------|
| Variables d'env | Validées par Zod au boot (`config/env.ts`) — **fail-fast** si `JWT_SECRET`/`QR_SECRET` absents ou < 32 caractères |
| Jeton d'accès | JWT HMAC-SHA256, **1 h** par défaut (`JWT_EXPIRES_IN`), porté par un cookie httpOnly `daaragest_token` (le header `Authorization: Bearer` reste accepté pour les clients API) |
| Renouvellement | Refresh token de 30 j en cookie httpOnly, **rotation** à chaque renouvellement avec 60 s de grâce (plusieurs onglets) ; refusé pour un compte désactivé |
| Révocation des sessions | `Utilisateur.token_version` portée par le jeton (`tv`) et vérifiée à chaque requête (cache 15 s invalidé à la révocation) : **désactivation, suppression, réinitialisation du mot de passe, changement de mot de passe, changement de rôle** coupent aussitôt les jetons d'accès **et** de rafraîchissement |
| Stockage du jeton (frontend) | **Aucun** — jamais exposé au JavaScript (cookie httpOnly) ; seul le profil utilisateur est en Zustand |
| Mots de passe | bcrypt cost 10 · politique : 8 caractères min., majuscule, minuscule, chiffre, caractère spécial · **changement obligatoire** à la première connexion (fenêtre dédiée qui reste affichée ; l'API refuse tout le reste en `403` tant qu'il n'est pas fait) · le nouveau doit différer de l'ancien |
| Verrouillage de compte | **Progressif** : 5 échecs → 1 min, 8 → 5 min, 11 → 15 min, 15+ → 60 min ; remis à zéro à la connexion réussie ou par une réinitialisation admin ; message avec la durée restante |
| Limites de connexion | `POST /auth/login` : 10 essais/min par couple (IP, identifiant) — tout le personnel d'une école (une seule IP publique) peut se connecter en même temps — et **30 échecs/10 min par IP** contre l'essai massif d'identifiants · refresh 10/min |
| Rate limiting global | **1000 req/15 min par utilisateur** (clé = hash du JWT ; repli sur l'IP pour les routes publiques) · portail parent 30/min et PDF de bulletin 10/min par IP |
| CSRF | Validation de l'en-tête `Origin` sur toutes les mutations (POST/PUT/PATCH/DELETE) — indispensable car le cookie est `SameSite=None` en production |
| CORS | Origines configurables via `CORS_ORIGIN` (multi, séparées par virgules) |
| Headers HTTP | `Content-Security-Policy` (report-only hors production), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `HSTS` (production) |
| Logs | Redaction automatique des mots de passe, cookies et en-têtes `Authorization` |
| Isolation établissements | Chaque requête filtre par `etablissement_id` tiré du JWT ; accès par identifiant hors établissement → « introuvable » ; documents, notes et scans du jour verrouillés par des tests d'intégration |
| Périmètre professeur | Un professeur ne voit et ne modifie que ses classes (`utils/portee.ts`), lectures **et** écritures — voir [Périmètre du professeur](#périmètre-du-professeur) |
| Validation | Zod sur tous les body POST/PUT · `z.coerce.number()` pour les Decimal Prisma |
| RBAC — routes | Groupes de rôles (`ROLE_GROUPS`) par route, y compris `FINANCES`/`FINANCES_GESTION` (le directeur et le conseiller pédagogique n'ont **aucun** accès finances, arbitrage établissement) — verrouillé par `rbac.test.ts` (dont la parité conseiller = directeur) |
| RBAC — payloads | `utils/sanitize.ts` cure les réponses par rôle : le hash `mot_de_passe` ne sort jamais, et `salaire_base`/`cni`/`qr_token` (Personnel) sont réservés aux rôles de gestion. Verrouillé par `rbac/payloads.itest.ts` (vérifie le contenu réel des réponses) |
| Erreurs | Gestionnaire central (`utils/errorHandler.ts`) : entrée invalide → `400` (champ + raison), erreur métier → son code, **`500` anonymisés** (« Erreur interne du serveur ») + capture Sentry ; jamais de message d'exception, de SQL ni d'identifiant interne dans une réponse |
| PDF | `escapeHtml()` sur toutes les données utilisateur avant insertion dans les templates ; **file de génération** à 3 rendus simultanés, `503` explicite après 60 s d'attente |
| QR codes | Signés HMAC-SHA256 (`QR_SECRET`) — un QR forgé est rejeté au scan ; régénérables individuellement (l'ancien est invalidé) |
| Portail parent | Jeton UUID en base, révocable, **expiration automatique** (fin de l'année scolaire active), rotation, sans compte utilisateur, actions tracées dans l'audit |
| Endpoints publics | `POST /pointage/scan` (borne, QR signé), portail parent (jeton), login/refresh, `/health`. La liste des scans du jour (`GET /pointage/scans-jour`) exige une session et ne renvoie que nom, prénom et heures |
| Proxy | `trustProxy` activé : derrière Railway, l'en-tête `X-Forwarded-For` falsifié par un client est ignoré (vérifié) ; ne jamais exposer le port de l'API sans proxy |
| Dépendances | `npm audit fix` appliqué (0 alerte critique) ; restent des montées majeures planifiées (voir Dette technique) |
| Audit | Journal « qui fait quoi » (voir [Journal d'audit](#journal-daudit)) |

### Flux d'authentification

```
1. POST /auth/login → { user } + cookies httpOnly (daaragest_token + daaragest_refresh)
2. Le jeton n'apparaît jamais dans le body ni dans le JavaScript (immunisé XSS)
3. Chaque requête : cookie envoyé automatiquement (credentials: include) ;
   Authorization: Bearer accepté en alternative pour les clients API
4. Backend : jwtVerify() → payload validé par Zod (id, role, etablissement_id, langue,
   theme, doit_changer_mdp, tv) → l'état du compte (actif ? version de session ?) est relu
5. Compte désactivé ou version de session dépassée → 401 ; mot de passe à changer → 403
6. Sur 401, le front appelle POST /auth/refresh (cookie refresh) puis rejoue la requête ;
   si le refresh échoue, retour à la page de connexion
```

### Configuration production

```bash
JWT_SECRET=<64+ caractères aléatoires>
QR_SECRET=<64+ caractères aléatoires>
JWT_EXPIRES_IN=1h
CORS_ORIGIN=https://votre-domaine.com
COOKIE_DOMAIN=.votre-domaine.com
NODE_ENV=production
SENTRY_DSN=<optionnel>
```

> ⚠️ Le compte `admin` créé par le seed doit changer son mot de passe initial dès la première connexion (l'application l'impose). Aucun mot de passe de développement ne doit exister en production.

---

## Tests & CI

Trois familles de tests :

| Famille | Volume | Commande | DB requise |
|---------|--------|----------|------------|
| Unitaires backend | 685 cas · 28 fichiers `*.test.ts` | `npm test` (backend) | Non |
| Intégration backend | 111 cas · 15 fichiers `*.itest.ts` (audit, auth/sessions, bulletins, cahier, classes/reconduction, documents/isolation, finances/reçus, suppression élève, paramètres, portail parent, progression, rapports, **payloads anti-fuite**, **périmètre professeur**, **rôle conseiller**) | `npm run test:integration` | **Oui (Postgres)** |
| UI frontend | 15 cas · 5 fichiers (Button, Badge, Pagination…) — Testing Library | `npm test` (frontend) | Non |

Principaux domaines couverts : calculs de bulletins (moyennes pondérées, mentions, classement, template), cycle de vie des générations, cahier de texte, pointage, matricules, reçus, validation des notes et barèmes, alertes d'absence, auth (hash, payload JWT, verrouillage progressif, révocation des sessions, délai de grâce du refresh), CSRF, documents/templates et **isolation entre établissements**, RBAC de tous les groupes (routes **et** payloads) et périmètre professeur, traduction des erreurs, plafond des échecs de connexion, file d'attente des PDF, phrases du journal d'audit (garde-fou de traduction FR/AR/EN), sécurité (injection, escapeHtml), filières, micro-templating.

> Convention de ce projet : chaque nouveau test de garde (RBAC, sécurité, règle métier) doit être prouvé par **injection de régression** — casser temporairement le code protégé, confirmer que le test échoue, puis restaurer — sinon le test peut être un faux positif qui teste une copie de la logique plutôt que le code de production.

### CI (GitHub Actions)

À chaque push/PR (`.github/workflows/ci.yml`) :

1. **Backend** — `prisma generate`, type-check, ESLint, tests unitaires, build
2. **Intégration** — Postgres 16 en service, **replay complet des migrations depuis zéro** (`prisma migrate deploy`), **installation à neuf** (migrations + seed de production sur une base vierge, deux fois), puis tests d'intégration
3. **Frontend** — type-check, tests, build Vite

> ⚠️ `npm test` local ne couvre pas les tests d'intégration : lancer `npm run lint` **et** `npm run test:integration` avant de pousser un changement de schéma ou de lecteurs. Après un `npm audit fix` du frontend, vérifier que `npm ci` passe à neuf (un lockfile réécrit sur macOS peut devenir invalide sous Linux).

---

## Roadmap — chantiers en cours

> **Modules déjà implémentés** : Filières génériques (entité `Filiere`, inscriptions N-filières, **colonnes string supprimées — refonte soldée**), Bulletins FR/AR/EN + combiné au choix, **cycle de vie des générations** (état à jour/périmé/partiel, régénération automatique après saisie de notes, nettoyage des orphelins) + **aperçu PDF**, Mentions configurables (seule source des seuils, libellé arabe sur les bulletins AR), Échelle d'affichage par niveau, Domaines & grilles IEF, Tarifs, Fonctions configurables, **Cahier de texte** (séances, devoirs, visa/verrouillage, complétude, export PDF, intégration portail parent), Pointage QR, Audit log, Demandes d'absence personnel, Évaluations formatives, Progression pluriannuelle, Activités parascolaires, Bibliothèque, Portail parents (bulletins PDF, **expiration auto, rotation, écran de gestion dédié**), Documents officiels (25 types), Rapports (11 types + aperçus), Tableau de bord analytique, Refresh tokens, Verrouillage de période des bulletins, Templates de bulletins éditables, **RBAC route + payload** (finances hors périmètre direction, payloads Personnel/Utilisateur curés par rôle), i18n FR/AR/EN synchronisée, **aide contextuelle in-app** (bouton « ? » par page), Sentry, CI complète.

### Phase 4 — Multi-établissement

Le socle multi-tenant existe (`etablissement_id` partout, JWT scopé). Reste l'onboarding : module `etablissements`, super-admin plateforme, branding par école. C'est la trajectoire produit visée (passage d'un déploiement mono-établissement à un **SaaS multi-tenant**) ; le plan détaillé — isolation RLS, provisioning/facturation, infra cible, coûts — est dans [`docs/SAAS-INFRA-PLAN.md`](docs/SAAS-INFRA-PLAN.md). À déclencher quand une deuxième école arrivera (la Phase A « isolation » de ce plan doit être terminée avant).

### Pointage NFC

Les modèles `PersonnelCarte`, `Pointage` et `HeureTravail` sont présents en schéma mais sans API (décision : conservés tels quels). Le pointage QR couvre le besoin actuel ; le NFC reste une évolution possible (badges physiques).

### Application mobile (React Native)

Expo + partage des types TypeScript, mode hors-ligne pour la saisie de notes et la messagerie.

### Priorités suggérées

| Chantier | Valeur métier | Complexité |
|----------|--------------|------------|
| Phase 4 multi-établissement | ★★★☆☆ | ★★★★☆ |
| Pointage NFC | ★★☆☆☆ | ★★★★☆ |
| App mobile | ★★★★★ | ★★★★★ |

---

## Dette technique

L'audit de cohérence de juillet 2026 (PR #126–#136) a soldé la dette précédemment listée ici : transition filières (colonnes string supprimées), consolidation des mentions (seuils fixes retirés), lien de navigation Audit, champs directeur legacy et stockage du token (cookie httpOnly seul). L'audit RBAC du 18 juillet 2026 (PR #157) a fermé le trou méthodologique restant : la matrice de rôles (`rbac.test.ts`) verrouillait **qui** appelle chaque route mais pas **ce que** la route renvoie — des `include` Prisma sans `select` laissaient fuiter le hash de mot de passe et la fiche RH (salaire, CNI, QR) à des rôles non autorisés, y compris sur un endpoint public. Corrigé via `utils/sanitize.ts` + `rbac/payloads.itest.ts`, avec au passage l'arbitrage établissement retirant tout accès finances au directeur. Restent connus :

### 1. Modèles NFC sans API *(priorité basse — décision : conservés)*

`PersonnelCarte`, `Pointage`, `HeureTravail` sont en schéma sans aucune route, réservés à un éventuel pointage par badge NFC. Le pointage QR couvre le besoin actuel.

### 2. Rapport socle IEF et filière EN *(niche, par conception)*

La grille officielle IEF est à colonnes fixes (LC FR / LC AR / Maths) — une matière-langue EN y tombe dans LC FR. L'anglais ne figure pas dans la grille officielle sénégalaise ; ne pas « corriger ».

### 3. Montées de version majeures reportées *(planifiées)*

`npm audit fix` a supprimé les alertes critiques. Restent des montées majeures à traiter une par une, avec non-régression PDF : `puppeteer` 25 (rendu des bulletins), `exceljs`, `react-router` 7, `vite` 8, `tailwindcss` 4, `eslint`. Pour puppeteer, le cast de `networkidle0` dans `utils/browserPool.ts` est à revérifier à chaque montée.

### 4. Isolation des établissements par filtre applicatif *(avant une 2ᵉ école)*

Chaque requête filtre manuellement par `etablissement_id` (pas de Row-Level Security PostgreSQL). Des tests d'intégration verrouillent les points sensibles, mais la RLS (Phase A de [`docs/SAAS-INFRA-PLAN.md`](docs/SAAS-INFRA-PLAN.md)) est requise avant d'accueillir un second établissement.

### 5. Limites d'architecture connues *(à traiter avec le passage SaaS)*

- Caches en mémoire du processus (session, paramètres) : non partagés entre instances.
- Génération PDF synchrone dans la requête (file à 3 rendus, `503` après 60 s) : une vraie file de tâches sera nécessaire à plus grande échelle.
- Les écritures d'un bulletin ne sont pas toutes dans une seule transaction.
- Logos et images stockés en base64 en base de données.
- Les scripts d'import historiques (`backend/prisma/lgm`, `personnel-ficaam`) n'ont plus lieu d'être dans le dépôt : à sortir une fois la migration terminée.

