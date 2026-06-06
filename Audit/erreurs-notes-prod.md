# Erreurs de notes — base de production (à corriger)

> Relevé établi le 2026-06-06 par comparaison base prod ↔ fichiers Excel
> `Notes_FICAAM_2025_2026_CalcCORRIGE.xlsx` + `Rapport_verification_Notes_FICAAM.xlsx`.
> Base : Railway `DaaraGest` / env `production` (établissement `etablissement-default`, année `2025-2026`).
>
> Bilan : **218 notes problématiques sur 13 753**, regroupées en 4 causes.
> Résolution du barème effectif : `ClasseMatierePeriode` → `ClasseMatiere.note_max_override` → `Matiere.note_max`.

## 🔴 A. Impact direct sur les moyennes (priorité haute)

### A1 — Anglais T2 compté mais jamais noté (156 notes à 0)
- Classes : **CP A, CP B, CI A, CI B** — filière FR, **trimestre 2**.
- Anglais a `coeff = 1` (compté) au T2, mais **les 156 notes valent 0**.
- Effet : 0 au numérateur + 10 de barème au dénominateur → **moyenne T2 sous-évaluée** pour ~156 élèves.
- Au T1, Anglais est bien à `coeff = 0` (exclu) — c'est seulement le T2 qui est en cause.
- **Fix possible** : soit saisir les vraies notes d'anglais, soit mettre `coeff = 0` pour Anglais T2 dans ces 4 classes (cohérent avec le T1).
- (= problème ① du rapport de vérification)

### A2 — CE2 B Arabe T1 : CLC saisie sur /40 au lieu de /20 (38 notes = toute la classe)
- Classe : **CE2 B (AR)**, trimestre 1, matière **Langue et Communication : Compétence (CLC)**.
- Valeurs 28 → 39 sur un barème app de **/20**.
- Les classes sœurs (CE1 A, CE1 B, CE2 A) notent bien la CLC sur /20 au T1.
- Effet : **moyennes de CE2 B T1 AR gonflées**, non comparables aux autres classes.
- **Fix possible** : re-saisir sur /20 (≈ ÷2), ou passer le barème de cette classe à /40 (et ajuster le coef).
- (= problème ② du rapport)

## 🟠 B. Notes « impossibles » isolées (fautes de frappe)

| Élève | Matricule | Classe | T | Matière | Note | Barème |
|---|---|---|---|---|---|---|
| ABDOU KARIM DIALLO | CAAM-E-26-243 | CP A | T1 | Résolution de Problèmes | **14** | /4 |
| ALIMATOU NIASS | CAAM-E-26-368 | CE1 B (AR) | T1 | RER (Mawarid) | **36,5** | /30 |
| FAMA FALL | CAAM-E-26-530 | CM2 A | T2 | RLC (FR) | **50** | /40 |

- À corriger individuellement.
- RER 36,5 = problème ③ du rapport.
- ⚠️ D'autres notes RLC = 50 existent en CE1 A / CE2 A / CE2 B (FR) mais sont **valides** (barème RLC /60 dans ces classes), donc non listées ici.

## 🟡 C. Barème de l'app à corriger — CM2 Arabe RLC/CLC inversés (21 notes hors barème)

- Classes : **CM2 A (AR), CM2 B (AR)** — T1 et T2.
- En CM2 AR, la CLC est saisie sur **/60** (notes 42 → 59) mais l'app a fixé son barème à **/40** ; et RLC est sur /40 mais l'app a /60.
- C'est **l'inverse du CM1** (RLC /40 + CLC /60) ; les données réelles suivent le standard du CM1.
- → **C'est le barème de l'app pour CM2 AR qui est faux** (RLC et CLC permutés).
- Impact sur la moyenne : **nul** (60+40 = 40+60), mais affiche 21 notes « impossibles » et casse l'uniformité.
- **Fix possible** : permuter les barèmes RLC ↔ CLC du CM2 AR pour les aligner sur le CM1.
- (= problème ④ du rapport)

## ✅ D. Vérifié — ce qui n'est PAS un problème

- **153 élèves sans aucune note** = la maternelle (PS 47 + MS 49 + GS 57 = 153), non notée dans ce système → normal.
- **Rés.Prob CP barème /4** : cohérent avec les données (toutes ≤ 4 sauf l'outlier 14) → ne pas toucher.
- 2 notes d'Abdou Karim Diallo (Écriture/Lecture = 9 vs Excel 10) : édition récente dans l'app, pas une erreur d'import.

---

# Incohérences de CODE (calculs de notes) — audit 2026-06-06

Référence de calcul correct : `bulletins.service.ts` → `contributionNote = (valeur / noteMax) * base * coeff`,
barème effectif résolu via `ClasseMatierePeriode` → `ClasseMatiere.note_max_override` → `Matiere.note_max`,
base = `ConfigNotes.note_max` (= 10). **rapports** et **progression** sont conformes. Deux modules ne l'étaient PAS.

> ✅ **CODE-1 à CODE-4 CORRIGÉS le 2026-06-06** (cf. ci-dessous). Reste à corriger : labels `/20` en dur
> dans le frontend hors dashboard (Bulletins, Eleves, i18n) — voir CODE-5.

## CODE-1 ✅ CORRIGÉ — Dashboard — moyennes par classe & top/bottom en moyenne BRUTE
- Fichier : `backend/src/modules/stats/stats.service.ts`
  - `getMoyennesParClasse` (~l.110-121) : `prisma.note.aggregate({ _avg: { valeur: true } })`
  - `getTopBottomEleves` (~l.136-147) : idem `_avg: { valeur: true }`
- Problèmes :
  1. Moyenne brute des `valeur` toutes échelles confondues (/60, /40, /20, /10) → **résultat sur une échelle absurde**, pas sur /10. Ex. **CM2 A : dashboard 21,58 vs réel 8,13/10**.
  2. Ignore les coefficients.
  3. Mélange les notes FR + AR d'un même élève (le filtre ne sépare pas la filière de la classe).
- **Correction** : `calculerStatsNotes()` (source unique) réutilise `calculerMoyennesClasse` du module bulletins, par classe et par filière, puis cumule par élève (moy globale = (moy FR + moy AR)/2). Le payload expose `note_max_base` ; le frontend Dashboard met l'échelle des barres/seuils sur cette base au lieu de `/20`.

## CODE-2 ✅ CORRIGÉ — Saisie des notes — validation contre le mauvais barème
- Fichier : `backend/src/modules/notes/notes.service.ts` (l.79-82)
- `const noteMax = Number(matiere.note_max)` → utilise le `Matiere.note_max` **plat (= 20)**, pas le barème effectif de la classe (`note_max_override` / `ClasseMatierePeriode.note_max`).
- Conséquences :
  - **Trop strict** : impossible de saisir/éditer via l'UI une note > 20 pour les matières /40 ou /60 (RLC, CLC, RM, CM…). Ces notes n'ont pu entrer que par import SQL direct.
  - **Trop laxiste** : pour les matières < 20 (Rés.Prob /4, A.Géo /8…), accepte jusqu'à 20 → c'est ainsi que **Rés.Prob = 14 (cf. B)** a pu être saisi.
- **Correction** : `bulkUpsertNotes` résout désormais le barème effectif (`ClasseMatierePeriode` → `ClasseMatiere.note_max_override` → `Matiere.note_max`) avant de valider min/max.

## CODE-3 ✅ CORRIGÉ — Alertes dépendaient d'une table Bulletin quasi vide
- `getAlertes` (stats) lit `Bulletin.moyenne < base/2` ; `progression` lit aussi `Bulletin`.
- Or **57 élèves seulement sur 408 notés ont un bulletin généré** (T1 FR:19, COMBINE:19 ; T2 COMBINE:57).
- Conséquence : **les alertes "note insuffisante" et la progression ignorent ~350 élèves** tant que les bulletins ne sont pas générés.
- **Correction** : l'alerte « note insuffisante » est calculée à la volée à partir de `calculerStatsNotes` (moyenne globale normalisée < `base/2`), indépendamment de la génération des bulletins.
- Mineur restant : `ConfigNotes.seuil_note_insuffisante = 10` n'est toujours pas utilisé par l'alerte (qui prend `base/2 = 5`) — à clarifier avec l'établissement.

## CODE-4 ✅ CORRIGÉ — Documents (relevés/synthèse) — barème de période ignoré
- Fichier : `backend/src/modules/documents/documents.service.ts`
- Relevé de classe : applique désormais `ClasseMatierePeriode.note_max` quand une période précise est demandée (matières dont le barème change T1→T2 : CLC arabe, RER…).
- Relevé individuel `RELEVE_NOTES` : `MOYENNE_ANNUELLE` était une **moyenne brute** des notes → désormais moyenne normalisée/pondérée via `calculerMoyennesClasse` (moy FR+AR)/2.

## CODE-5 ✅ CORRIGÉ — labels `/20` en dur dans le frontend
- Nouveau store `frontend/src/store/noteScaleStore.ts` (`useNoteMax()`) : charge `ConfigNotes.note_max` une fois et l'expose à l'UI.
- **Bulletins** : `moyenneColor`/`moyenneVariant` paramétrés par la base (seuils 0,7 et 0,5 de l'échelle) ; labels `/20` → `/{noteMax}` (cartes, table, détail, stats classe).
- **Eleves** : moyenne du bulletin `/20` → `/{noteMax}`, seuil couleur sur `base*0.5`.
- **Dashboard** : barres + seuils sur `note_max_base` ; alerte i18n `moyenne_sur_20` → `moyenne_sur` avec `{{max}}`.
- **PortailParent** (public) : avait en plus une `calcMoyenne` **brute** (val×coeff sans normalisation) → désormais normalisée via barème effectif renvoyé par l'API (`note_max_effectif`/`coeff_effectif`) + base (`note_max_base`) ; labels et seuils alignés.
- Restant mineur : 3 clés i18n mortes « Note /20 » (`note.valeur`, `portail_parent.col_note`, `activite.col_note`) non rendues — laissées telles quelles. Les notes d'**activités parascolaires** restent en `/20` (sous-système sans barème défini).

---

## Récapitulatif données

| Cause | Notes concernées | Impact moyenne |
|---|---|---|
| A1 Anglais T2 non noté (CP/CI) | 156 | Sous-évalue |
| A2 CLC CE2 B AR sur /40 | 38 | Gonfle |
| B Fautes de frappe isolées | 3 | Gonfle (ponctuel) |
| C CM2 AR RLC/CLC permutés | 21 | Neutre (affichage) |
| **Total** | **218 / 13 753** | |
