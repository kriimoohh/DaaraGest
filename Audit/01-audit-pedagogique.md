# 01 — Audit Pédagogique

> Périmètre : modèle métier scolaire, couverture fonctionnelle, workflows pédagogiques, adaptation au contexte franco-arabe sénégalais.

**Note globale : 8.5/10** (↑ de 8/10) — P1 et P2 du précédent audit corrigés, nouveaux modules majeurs (évaluations, demandes d'absence personnel, fonctions, rapports académiques) qui élargissent la couverture fonctionnelle. La dette qualitative (compétences, livret comportement) reste.

---

## ✅ Acquis depuis l'audit précédent (2026-05-19)

| Ancien constat | État | Référence |
|---|---|---|
| P1 — Note plafonnée à 20 dans Zod | ✅ **Corrigé** | [notes.schema.ts:11](../backend/src/modules/notes/notes.schema.ts#L11) — `valeur: z.number().min(0)` sans `.max()`, plafond délégué à la matière |
| P2 — Bulletins annuels hardcodés sur 3 trimestres | ✅ **Corrigé** | [bulletins.service.ts:137-140](../backend/src/modules/bulletins/bulletins.service.ts#L137) — `nbPeriodes = config?.nb_periodes ?? 3`, array dynamique |
| P6 — Charges horaires professeurs | 🟡 **Partiel** | Rapport "présences professeurs" ([rapports.service.ts](../backend/src/modules/rapports/rapports.service.ts)) mais pas de consolidation `Creneau` → heures hebdo |

## 🆕 Nouveaux acquis fonctionnels

### Refactor Personnel (anciennement Professeur)
[schema.prisma:114-142](../backend/prisma/schema.prisma#L114) — table `Personnel` unifiée (prof, surveillant, infirmier, etc.) avec :
- Fonction configurable par établissement (table `Fonction` lignes 99-112)
- Contrat (`contrat_type`, `date_debut_contrat`, `date_fin_contrat`, `est_stagiaire`)
- Civilité (M/Mme/Mlle) → utilisée pour les accords en genre des documents

### Module Évaluations formatives
[schema.prisma:666-706](../backend/prisma/schema.prisma#L666) — `Evaluation` + `NoteEvaluation` :
- Types `DS / INTERRO / DM / EXAMEN`
- `note_max` flexible (1-100), `periode` dynamique
- Coefficient propre à l'évaluation
- Schema validation Zod : `note_max: z.number().min(1).max(100)` ([evaluations.schema.ts](../backend/src/modules/evaluations/evaluations.schema.ts))

### Module Demandes d'Absence Personnel
[schema.prisma:925-946](../backend/prisma/schema.prisma#L925) + [module dédié](../backend/src/modules/demandes-absence-personnel) — workflow congés/maladies/permissions :
- Statuts `EN_ATTENTE → APPROUVE / REFUSE`
- Justificatif joint, motif typé
- Notifications direction + tracking complet

### Module Rapports académiques (9 rapports)
[rapports.service.ts](../backend/src/modules/rapports/rapports.service.ts) avec aperçus HTML universels :
1. Présences élèves (CSV/PDF) — par classe/mois
2. Présences professeurs (CSV/PDF) — par mois
3. Résultats classe (CSV/PDF)
4. Bilan financier (CSV/PDF)
5. **Grille IEF par niveau** (PDF) — pédagogique sénégalais officiel
6. **Grille performance** par domaine (PDF)
7. Performance domaine (PDF)
8. Relevé notes (PDF)
9. **Propositions de fin d'année** (PDF multilingue avec décision + moyenne T1/T2/T3) — ligne 1276+

### Domaines pédagogiques structurés
[schema.prisma:281-311](../backend/prisma/schema.prisma#L281) — `Matiere.domaine` (`LANGUE_COMMUNICATION | MATHEMATIQUES | ESVS | EPSA | AUTRE`) + `type_note` (`SIMPLE | RESSOURCE | COMPETENCE`). Permet la production des grilles IEF qui regroupent les matières par domaine.

### Groupes de grilles par niveau
[schema.prisma:321](../backend/prisma/schema.prisma#L321) — `Niveau.groupe_grille` (`CI_CP`, `CE1_CE2`, `CM1_CM2`) avec seuils de performance configurés (7/10 et 8/10 pour CI_CP ; 5/10 et 7/10 pour les autres) — alignement IEF officiel.

### Tables Fonction par établissement
[fonctions.service.ts](../backend/src/modules/fonctions/fonctions.service.ts) — chaque établissement peut définir ses fonctions (Directeur, Surveillant, Infirmier…) avec libellés FR/AR et flag supprimable. Évite la rigidité d'un enum côté code.

### Progression semi-automatisée
[progression.service.ts:93](../backend/src/modules/progression/progression.service.ts#L93) — `decision_auto` calculée à partir de la moyenne annuelle vs `seuil_passage`. Validable manuellement par direction.

---

## ✅ Points forts inchangés

- **Couverture fonctionnelle exhaustive** — 33 modules backend, 23 pages frontend, cycle scolaire complet
- **Double filière FR / AR native** — `Inscription.classe_fr_id` + `classe_ar_id` ([schema.prisma:429-430](../backend/prisma/schema.prisma#L429))
- **Bilinguisme RTL complet** — **418 clés i18n** par langue (FR + AR), basculement RTL instantané
- **4 types de bulletins** — FR / AR / COMBINE / ANNUEL (`periode=0`)
- **Coefficients par classe (override matière)** — `ClasseMatiere.coeff_override` ([schema.prisma:358](../backend/prisma/schema.prisma#L358))
- **Activités parascolaires complètes** — 5 modèles (`Activite`, `InscriptionActivite`, `SeanceActivite`, `PresenceActivite`, `EvaluationActivite`)
- **Alertes automatiques** — élève au-dessus du `seuil_absences_alerte` → notif direction
- **Génération PDF classe entière** — un appel produit toute la classe

---

## ⚠️ Limites pédagogiques restantes

### P1 — Appréciations bulletins toujours en français figé (non-i18nisé)
[bulletins.service.ts:7-13](../backend/src/modules/bulletins/bulletins.service.ts#L7) :
```ts
function appreciation(m: number): string {
  if (m >= 16) return 'Très bien — Félicitations du conseil';
  if (m >= 14) return 'Bien';
  if (m >= 12) return 'Assez bien';
  if (m >= 10) return 'Passable';
  return 'Insuffisant — Doit faire des efforts';
}
```
Un bulletin AR ou COMBINE affiche `Très bien` en arabe → incohérent.

**Fix** : i18nextNode côté serveur, ou table `Appreciation` paramétrable par établissement (seuils + libellés FR/AR).

**Effort :** 1 j · **Impact :** cohérence bilingue + souplesse pédagogique.

---

### P2 — Calendrier scolaire ne bloque toujours pas la saisie hors-période
[calendrier.service.ts](../backend/src/modules/calendrier/calendrier.service.ts) — CRUD pur. Aucun middleware ne vérifie qu'une absence/note/créneau ne tombe pas dans un `EvenementCalendrier` de type `vacances` ou `fermeture`.

**Fix** : middleware backend qui rejette `date ∈ [date_debut, date_fin]` d'un événement bloquant. Bonus côté frontend : griser les dates dans les pickers.

**Effort :** 0.5 j · **Impact :** évite les erreurs de saisie pendant les congés.

---

### P3 — Évaluation par compétences toujours absente
- `Matiere.type_note` accepte `RESSOURCE | COMPETENCE | SIMPLE` ([schema.prisma:296](../backend/prisma/schema.prisma#L296)) mais aucune table `Competence` ni `EvaluationCompetence` n'existe
- Les grilles IEF utilisent des seuils de performance par domaine, ce qui s'approche, mais ne remplace pas un référentiel de compétences nommées

Non adapté à :
- L'évaluation par compétences (socle commun français)
- L'approche par objectifs (programmes daara modernes structurés en savoir-faire)

**Effort** : refonte importante — nouveau modèle `Competence` lié à `Matiere`, table `EvaluationCompetence(eleve_id, competence_id, niveau_atteint)`.

---

### P4 — Pas de lien programme officiel ↔ matières
Toujours aucun référentiel attaché à `Matiere`. `domaine` structure pédagogiquement mais ne renvoie pas vers un PDF officiel ou des objectifs nommés.

**Fix léger** : ajouter `Matiere.programme_url` (lien vers PDF officiel) et/ou `Matiere.objectifs_json` validé par Zod.

**Effort :** 2 h · **Impact :** prépare P3 (évaluation par compétences).

---

### P5 — Pas de suivi qualitatif (livret de comportement)
Seules `Bulletin.observation_fr / _ar / _prof` capturent du qualitatif. Manquent toujours :
- Fiche pédagogique d'observation par classe/élève
- Suivi du comportement quotidien (politesse, participation, soin du matériel)
- Conseil de classe / vie scolaire

**Effort :** 2 j · **Impact :** couvre la vie scolaire.

---

### P6 — Redoublement : pas de report automatique des inscriptions
La décision est calculée auto ([progression.service.ts:93](../backend/src/modules/progression/progression.service.ts#L93)) mais l'élève doit toujours être manuellement réinscrit l'année suivante. Aucun écran "Préparer la rentrée".

**Fix** : workflow guidé qui auto-inscrit selon la décision :
- `admis` → niveau suivant + ancienne classe ou classe à choisir
- `redoublant` → même niveau
- `transfere / exclu` → archivage propre

**Effort :** 1 j · **Impact :** gain de temps massif en fin d'année.

---

### P7 — Pas de gestion de branches/options en collège-lycée
Toujours pas de table `OptionEleve`. Une classe = un cursus unique. Pas de gestion :
- Option latin / arabe renforcé / sport
- Filière S / L / ES au lycée
- Choix d'une langue vivante 2

**Effort :** 3 j · **Impact :** cible collège-lycée.

---

### P8 — Charges horaires personnel non consolidées
`Creneau` ([schema.prisma:545-565](../backend/prisma/schema.prisma#L545)) existe (refactoré pour `personnel_id`) mais aucun rapport ne calcule "heures de cours par personnel par semaine". Or c'est une donnée RH critique avec les nouveaux contrats (`contrat_type`, `est_stagiaire`).

**Fix** : ajouter une route `/api/v1/rapports/charges-personnel` qui groupe `Creneau` par `personnel_id` et somme `heure_fin - heure_debut` par semaine.

**Effort :** 2 h · **Impact :** complète le module RH (paie horaire des vacataires).

---

### P9 — Pas d'export bulletin individuel multilingue côté parent
Le portail parent ([portail-parent.routes.ts](../backend/src/modules/portail-parent/portail-parent.routes.ts)) expose les notes mais pas un téléchargement direct du bulletin PDF dans la langue du parent. C'est dommage vu que le moteur de PDF gère déjà FR/AR/COMBINE.

**Fix :** route `/portail/acces/:token/bulletin/:bulletin_id/pdf` qui sert le PDF directement.

**Effort :** 1 h · **Impact :** ferme la boucle parent.

---

### P10 — Demandes d'absence personnel : pas de calcul des soldes
[demandes-absence.service.ts](../backend/src/modules/demandes-absence-personnel/demandes-absence.service.ts) gère les demandes mais ne tient pas un compteur "jours de congés restants" par personnel. Or c'est une donnée RH attendue.

**Fix :** ajouter `Personnel.solde_conges_jours` + décrément à l'approbation d'une demande de type CONGE.

**Effort :** 4 h · **Impact :** module RH complet.

---

## 🎯 Priorisation

| Priorité | Action | Effort | Impact |
|---|---|---|---|
| 🟠 P1 | **P1** : i18n des appréciations bulletin (ou table paramétrable) | 1 j | Cohérence FR/AR |
| 🟠 P1 | **P8** : rapport charges hebdo par personnel | 2 h | Donnée RH manquante |
| 🟠 P1 | **P9** : téléchargement bulletin PDF via portail parent | 1 h | UX parent |
| 🟠 P1 | **P2** : blocage saisie hors-période vacances | 0.5 j | Évite erreurs de saisie |
| 🟡 P2 | **P6** : workflow "Préparer la rentrée" | 1 j | Gain de temps fin d'année |
| 🟡 P2 | **P10** : compteur solde de congés personnel | 4 h | Module RH complet |
| 🟡 P2 | **P4** : champ `objectifs_json` sur Matiere | 2 h | Prépare P3 |
| 🟢 P3 | **P5** : fiche comportement quotidien | 2 j | Couverture vie scolaire |
| 🟢 P3 | **P7** : options/branches élève | 3 j | Cible collège-lycée |
| 🔵 P4 | **P3** : évaluation par compétences (refonte) | 1-2 sem | Marché élargi (maternelle / primaire moderne) |

---

## 📊 Verdict pédagogique

Le produit a **mûri visiblement** depuis l'audit précédent : les deux blocages techniques (Zod note plafonnée à 20, bulletins annuels hardcodés sur 3 trimestres) sont corrigés, et trois modules majeurs (**Évaluations formatives**, **Demandes d'Absence Personnel**, **Rapports académiques** dont les grilles IEF officielles) renforcent l'ancrage pédagogique sénégalais.

Le refactor `Professeur → Personnel` était attendu : il unifie tout le corps enseignant et administratif sous un même modèle, avec **fonctions configurables par établissement** (table `Fonction`). C'est un vrai pas pour la flexibilité multi-établissement.

Les manques principaux restent l'**évaluation par compétences** (refonte structurelle) et le **suivi qualitatif** (livret de comportement). Le calendrier scolaire qui ne bloque pas la saisie hors-période reste une dette à coût modéré.

Une fois P1+P2+P8+P9 traités (~2 j), le produit couvrira **>95% des besoins** d'une école franco-arabe primaire-secondaire au Sénégal.
