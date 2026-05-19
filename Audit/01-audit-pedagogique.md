# 01 — Audit Pédagogique

> Périmètre : modèle métier scolaire, couverture fonctionnelle, workflows pédagogiques, adaptation au contexte franco-arabe sénégalais.

**Note globale : 8/10**

---

## ✅ Points forts

### Couverture fonctionnelle exhaustive
27 modules backend, 19 pages frontend couvrent le cycle scolaire complet : inscription → notes → bulletin → finances → archivage pluriannuel via [progression.service.ts](../backend/src/modules/progression/progression.service.ts).

### Double filière FR / AR native
Un élève peut être inscrit simultanément dans une classe FR **et** une classe AR ([schema.prisma:265-266](../backend/prisma/schema.prisma#L265)) :
- `Inscription.classe_fr_id` + `Inscription.classe_ar_id`
- Bulletin `COMBINE` fusionne les moyennes FR + AR
- Système rare et adapté aux daara modernes sénégalais

### Bilinguisme RTL complet
- 410 clés i18n par langue
- Basculement RTL instantané ([Login.tsx:22-28](../frontend/src/pages/Login.tsx#L22))
- Polices arabes dédiées (Noto Naskh)

### 4 types de bulletins + génération annuelle
[bulletins.service.ts:69-178](../backend/src/modules/bulletins/bulletins.service.ts#L69) :
- FR / AR / COMBINE / ANNUEL (`periode=0`)
- Génération PDF classe entière en un appel
- Classement automatique par rang

### Coefficients par classe (override matière)
[bulletins.service.ts:25-29](../backend/src/modules/bulletins/bulletins.service.ts#L25) :
- `ClasseMatiere.coeff_override` permet à un même cours d'avoir un coefficient différent en CE2 et en CM2
- Bonne pratique pédagogique reconnue

### Workflow début d'année documenté
README liste un workflow linéaire en 9 étapes (Paramètres → Années → Matières → Classes → Élèves → Professeurs → Emploi du temps → Calendrier → Notes/Bulletins).

### Évaluations formatives distinctes des notes trimestrielles
[schema.prisma:564](../backend/prisma/schema.prisma#L564) — modèle `Evaluation` séparé permet le **contrôle continu** (DS / INTERRO / DM / EXAMEN) avec coefficients propres.

### Progression pluriannuelle
Décision `admis | redoublant | transferé | exclu` validable par direction ([schema.prisma:606-624](../backend/prisma/schema.prisma#L606)). Historique académique élève consultable.

### Activités parascolaires
Modèles dédiés : `Activite` + `InscriptionActivite` + `SeanceActivite` + `PresenceActivite` + `EvaluationActivite`. Très complet.

### Alertes automatiques
[absences.service.ts](../backend/src/modules/absences/absences.service.ts) + notifications :
- Élève au-dessus du `seuil_absences_alerte` → notif admin/directeur
- Professeur absent → notif direction

---

## ⚠️ Limites pédagogiques

### P1 — Note plafonnée à 20 dans Zod
[notes.schema.ts:8](../backend/src/modules/notes/notes.schema.ts#L8) :
```ts
valeur: z.number().min(0).max(20),
```
Alors que `Matiere.note_max` est configurable (jusqu'à 999.99 via `Decimal(5,2)`). Une matière configurée sur /100 ou /40 ne pourra pas être saisie.

**Fix** : retirer `.max(20)` de Zod, laisser la validation faire son travail dans `bulkUpsertNotes` qui vérifie contre `matiere.note_max` ([notes.service.ts:60-65](../backend/src/modules/notes/notes.service.ts#L60)).

### P2 — Bulletins annuels hardcodés sur 3 trimestres
[bulletins.service.ts:141](../backend/src/modules/bulletins/bulletins.service.ts#L141) :
```ts
periode: { in: [1, 2, 3] }
```
Pas de support des semestres (2 périodes) ou cycles bimestriels (6 périodes). `ConfigNotes.nb_periodes` existe pourtant pour configurer.

**Fix** : `periode: { in: Array.from({length: config.nb_periodes}, (_, i) => i + 1) }`.

### P3 — `appreciation()` non internationalisée
[bulletins.service.ts:5-11](../backend/src/modules/bulletins/bulletins.service.ts#L5) — chaînes en français figé : "Très bien — Félicitations du conseil", "Insuffisant — Doit faire des efforts".

**Fix** : tabler sur `i18next` côté serveur, ou table `Appreciation` paramétrable par établissement (les écoles ne disent pas toutes "Insuffisant").

### P4 — Aucune gestion de compétences / objectifs pédagogiques
Uniquement des notes chiffrées. Non adapté à :
- L'évaluation par compétences (socle commun français)
- L'approche par objectifs (programmes daara modernes)
- Les écoles maternelles/primaires qui s'éloignent du chiffré

**Effort** : refonte importante — nouveau modèle `Competence` lié à `Matiere`, table `EvaluationCompetence`.

### P5 — Pas de lien programme officiel ↔ matières
Aucun référentiel national sénégalais ni programme daara n'est attaché aux matières. Une matière est juste un libellé + coefficient.

**Fix léger** : ajouter `Matiere.programme_url` (lien vers PDF officiel) ou `Matiere.objectifs_json` (liste structurée).

### P6 — Charge horaire / service hebdomadaire des professeurs non consolidé
`Creneau` existe ([schema.prisma:454-473](../backend/prisma/schema.prisma#L454)) mais aucun rapport ne calcule "heures de cours par prof par semaine". Or c'est une donnée RH critique (suivi de service, calcul du salaire à l'heure).

**Fix** : ajouter une route `/api/v1/rapports/charges-professeurs` qui groupe `Creneau` par `professeur_id` et somme `heure_fin - heure_debut`.

### P7 — Calendrier scolaire ne bloque pas la saisie hors-période
- `EvenementCalendrier.type = 'vacances'` existe ([schema.prisma:475-491](../backend/prisma/schema.prisma#L475))
- Mais **rien ne vérifie** qu'une absence/note/créneau ne tombe pas en vacances
- Vérification client uniquement (et encore, partielle)

**Fix** : middleware côté backend qui rejette `date ∈ [date_debut, date_fin]` d'un événement `vacances`.

### P8 — Pas de suivi qualitatif (livret de comportement)
Seules `Bulletin.observation_fr / _ar / _prof` ([schema.prisma:417-419](../backend/prisma/schema.prisma#L417)) capturent du qualitatif. Manquent :
- Fiche pédagogique d'observation par classe/élève
- Suivi du comportement quotidien (politesse, participation, soin du matériel)
- Conseil de classe / vie scolaire

### P9 — Redoublement : pas de report automatique des inscriptions
`ProgressionEleve.decision = 'redoublant'` est stocké mais l'élève doit être manuellement réinscrit l'année suivante dans la même classe.

**Fix** : workflow guidé "Préparer la rentrée" qui auto-inscrit selon la décision (`admis` → niveau suivant, `redoublant` → même niveau, `transfere/exclu` → archivage).

### P10 — Pas de gestion de branches/options en collège-lycée
Le modèle assume une classe → un cursus unique. Pas de gestion :
- Option latin / arabe renforcé / sport
- Filière S / L / ES au lycée
- Choix d'une langue vivante 2

`LISTE_MATIERES` est figée par établissement, pas adaptable à l'élève.

**Effort** : table `OptionEleve(eleve_id, matiere_id, annee_scolaire_id)` qui complète `Inscription`.

---

## 🎯 Priorisation

| Priorité | Action | Effort | Impact |
|---|---|---|---|
| 🟠 P1 | **P1** : retirer `max(20)` Zod et déléguer à la matière | 5 min | Débloque les écoles à notation non standard |
| 🟠 P1 | **P2** : nb_periodes dynamique pour bulletin annuel | 30 min | Support semestres / 6 périodes |
| 🟠 P1 | **P6** : rapport charges horaires par professeur | 2 h | Donnée RH manquante critique |
| 🟡 P2 | **P7** : blocage saisie hors-période vacances | 0.5 j | Évite erreurs de saisie |
| 🟡 P2 | **P3** : `Appreciation` paramétrable par établissement | 1 j | Souplesse pédagogique |
| 🟡 P2 | **P9** : workflow "Préparer la rentrée" auto-inscription | 1 j | Gain de temps massif en fin d'année |
| 🟢 P3 | **P5** : champ `objectifs_json` sur Matiere | 2 h | Préparer P4 |
| 🟢 P3 | **P8** : fiche comportement quotidien | 2 j | Couverture vie scolaire |
| 🟢 P3 | **P10** : options/branches élève | 3 j | Cible collège-lycée |
| 🔵 P4 | **P4** : évaluation par compétences (refonte) | 1-2 sem | Marché élargi (maternelle / primaire moderne) |

---

## 📊 Verdict pédagogique

**Couverture remarquable** pour le marché école franco-arabe sénégalais. Le modèle métier est mûr, la double filière FR/AR est un vrai atout différenciant rarement bien fait. Les modules `Progression`, `Activites`, `Bibliotheque` témoignent d'une vision complète.

Les manques principaux sont l'**évaluation par compétences** (refonte structurelle) et le **suivi qualitatif** (livret de comportement). Les corrections P1 demandent quelques heures et débloquent immédiatement plus d'établissements.

Une fois P1+P2 traités, le produit couvrira **>90% des besoins** d'une école franco-arabe primaire-secondaire au Sénégal.
