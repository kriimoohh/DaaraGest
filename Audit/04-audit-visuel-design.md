# 04 — Audit Visuel & Design

> Périmètre : système de design (tokens, palette, typo), composants UI, layouts, landing page, dark mode, RTL, accessibilité (WCAG).

**Note globale : 7.5/10** — identité graphique singulière et système solide, mais bugs visuels silencieux et incohérences à corriger.

---

## ✨ Points forts

### Identité graphique singulière et culturellement ancrée
- Palette **terracotta / papier chaud / encre brune** rare dans l'univers SaaS éducatif
- Référence visuelle au *daara* sénégalais (papier, latérite, encre) — cohérente et reconnaissable
- 4 polices typées par rôle :
  - **Fraunces** (display, titres, KPI)
  - **Instrument Sans** (UI, paragraphes)
  - **JetBrains Mono** (matricules, reçus) — `font-feature-settings: 'tnum', 'zero'` ([index.css:146](../frontend/src/index.css#L146))
  - **Noto Naskh Arabic** (RTL)
- Logo en deux variantes : monogramme `Dg` ([LogoIcon.tsx](../frontend/src/components/ui/LogoIcon.tsx)) + planchette *lawh* stylisée ([LogoMark.tsx](../frontend/src/components/ui/LogoMark.tsx))
- 3 variantes de couleur du logo (terra / paper / inverse) — pensé.

### Système de tokens solide
- **64 variables CSS** : `--paper`, `--ink-4`, `--terra-deep`, `--sahel-soft`, `--indigo-ink`, sémantiques (`--success`, `--warning`, `--danger`, `--info`) ([index.css:6-75](../frontend/src/index.css#L6))
- **Dark mode complet et réfléchi** : 36 variables inversées, pas une simple inversion (terracotta passe de `#B85433` à `#E8825F` plus chaud) ([index.css:77-115](../frontend/src/index.css#L77))
- Bascule fluide via `data-theme` sur `<html>` ([useTheme.ts:11](../frontend/src/hooks/useTheme.ts#L11)), synchronisée DB
- Tokens de **radius** (xs/sm/md/lg/xl), **shadow** (sm/md/lg), **layout** (sidebar-w, topbar-h)

### RTL natif dans le CSS principal
- Propriétés logiques systématiques : `border-inline-end`, `inset-inline-start`, `padding-inline-start`, `margin-inline-start`
- Sidebar et grille `app` inversent leurs colonnes en RTL ([index.css:155](../frontend/src/index.css#L155))
- Polices switchées automatiquement : `html[dir="rtl"] body { font-family: var(--font-arabic)… }` ([index.css:132-134](../frontend/src/index.css#L132))

### Composants UI propres
- [Button](../frontend/src/components/ui/Button.tsx) : 5 variants × 3 sizes + spinner intégré
- [Modal](../frontend/src/components/ui/Modal.tsx) : gère Escape + scroll-lock + click outside (lignes 22-31)
- [Table](../frontend/src/components/ui/Table.tsx) : skeleton rows + tri + état vide
- [Badge](../frontend/src/components/ui/Badge.tsx) : 8 variants sémantiques + outline + accent
- [ToastContainer](../frontend/src/components/ui/Toast.tsx) : icônes SVG colorées par type

### Responsive 3 paliers
[index.css:798-860](../frontend/src/index.css#L798) :
- **≤ 1024px** : sidebar collapse en rail d'icônes (72px), grilles 4 col → 2 col
- **≤ 640px** : sidebar drawer avec backdrop, burger menu, grilles → 1 col, tables scrollables
- `@media print` masque sidebar/topbar

### Bonnes pratiques accessibilité ponctuelles
- `:focus-visible` avec outline `terra-soft` 3px, offset 2px ([index.css:502-506](../frontend/src/index.css#L502))
- `aria-label` sur Modal close, Toast close, Burger menu, ActionMenu trigger
- Transitions courtes (`0.12s` à `0.2s`)

---

## 🔴 Critiques (P0) — bugs visuels silencieux

### V1 — Variables CSS référencées mais **non définies**

Le grep révèle **16+ références** à 4 tokens qui n'existent **pas** dans [index.css](../frontend/src/index.css) :

| Token utilisé | Occurrences | Devrait être | Symptôme visuel |
|---|---|---|---|
| `var(--surface-2)` | 8 | `var(--paper-2)` | Barre de progression / panneau sans fond |
| `var(--border)` | 5 | `var(--rule)` | Bordure invisible |
| `var(--radius)` | 2 | `var(--r-md)` | Coins **non arrondis** |
| `var(--text-muted)` | 1 | `var(--ink-3)` | Texte couleur par défaut (foncé) |

**Occurrences concrètes :**

- [Dashboard.tsx:53](../frontend/src/pages/Dashboard.tsx#L53) — Barre de progression "présence élèves" : **track invisible**
- [Dashboard.tsx:199](../frontend/src/pages/Dashboard.tsx#L199) — Barres moyennes par classe : track invisible
- [Dashboard.tsx:221,233](../frontend/src/pages/Dashboard.tsx#L221) — Top5/Bottom5 élèves : séparateurs absents
- [Evaluations/index.tsx:356-357](../frontend/src/pages/Evaluations/index.tsx#L356) — Carte "évaluation sans note" : ni fond ni bordure
- [Rapports/index.tsx:131](../frontend/src/pages/Rapports/index.tsx#L131) — Cartes type rapport non sélectionnées : invisibles
- [Rapports/index.tsx:212](../frontend/src/pages/Rapports/index.tsx#L212) — Bordure top
- [Rapports/index.tsx:222](../frontend/src/pages/Rapports/index.tsx#L222) — Boutons format export
- [Classes/index.tsx:927](../frontend/src/pages/Classes/index.tsx#L927) — Panel info en haut, fond transparent
- [Professeurs/index.tsx:517](../frontend/src/pages/Professeurs/index.tsx#L517) — Zone photo prof en upload sans fond
- [Bibliotheque/index.tsx:217](../frontend/src/pages/Bibliotheque/index.tsx#L217) — Tabs livres/emprunts sans border
- [Bibliotheque/index.tsx:452](../frontend/src/pages/Bibliotheque/index.tsx#L452) — Grille livre sans border
- [Parametres/index.tsx:795](../frontend/src/pages/Parametres/index.tsx#L795) — "Aucun niveau défini" non muted
- [index.css:945, 960](../frontend/src/index.css#L945) — `.action-menu-btn` et `.action-menu-dropdown` : **coins droits**

**Fix immédiat** (option A — aliasing dans `:root`) :
```css
:root {
  /* ... existing ... */
  /* Alias rétrocompatibilité (à supprimer après migration) */
  --surface-2: var(--paper-2);
  --border: var(--rule);
  --radius: var(--r-md);
  --text-muted: var(--ink-3);
}
```

**Fix propre** (option B — find+replace) :
```bash
# Backend root
cd frontend/src
grep -rl '--surface-2' . | xargs sed -i '' 's/--surface-2/--paper-2/g'
grep -rl '--border)' . | xargs sed -i '' 's/--border)/--rule)/g'
grep -rl '--radius)' . | xargs sed -i '' 's/--radius)/--r-md)/g'
grep -rl '--text-muted' . | xargs sed -i '' 's/--text-muted/--ink-3/g'
```

**Effort :** 15 min · **Impact :** corrige ~16 bugs visuels actuels.

---

### V2 — Animation `pulse` référencée mais non définie

**Fichier :** [Table.tsx:27](../frontend/src/components/ui/Table.tsx#L27)

```tsx
<div style={{ height: 14, background: 'var(--paper-3)', borderRadius: 4,
              animation: 'pulse 1.5s ease-in-out infinite' }} />
```

`@keyframes pulse` **n'existe pas** dans [index.css](../frontend/src/index.css) (seules `fadeIn` et `slideUp` y sont). Les skeleton rows s'affichent **figés** au lieu de pulser → l'utilisateur croit que ça a planté pendant un chargement.

**Fix :** ajouter dans `index.css` :
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.4; }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
```
(Le `@keyframes spin` est aussi utilisé via inline `<style>` dans [Login.tsx:139](../frontend/src/pages/Login.tsx#L139) — devrait être global.)

**Effort :** 2 min · **Impact :** skeletons enfin animés, spinner centralisé.

---

### V3 — La page Scanner QR est **hors design system**

**Fichier :** [Pointage/Scanner.tsx:180-300](../frontend/src/pages/Pointage/Scanner.tsx#L180)

Utilise une **palette Tailwind slate/blue hardcodée** :
```
#0f172a (fond), #1e293b (carte), #334155 (border),
#94a3b8 #64748b (texte secondaire), #3b82f6 (bouton), #f1f5f9 (texte principal)
```

Aucun rapport avec la palette daara. Pour un utilisateur qui scanne son QR au quotidien, c'est une **rupture totale d'identité** : on dirait une autre app.

**Fix :** repeindre aux tokens :
```tsx
background: 'var(--ink)',       // au lieu de '#0f172a'
color: 'var(--paper)',          // au lieu de '#f1f5f9'
// Card scanner :
background: 'var(--paper-3)',   // ou var(--ink-2) selon contraste
border: '1px solid var(--rule)',
// Bouton démarrer :
background: 'var(--terra)',     // au lieu de '#3b82f6'
```

**Effort :** 1 h · **Impact :** identité unifiée sur l'écran terrain le plus utilisé.

---

## 🟠 Hautes (P1) — incohérences structurelles

### V4 — Tailwind présent mais quasi inutilisé
- [tailwind.config.ts](../frontend/tailwind.config.ts) configure `darkMode: ['attribute', 'data-theme']` + tokens custom
- [index.css:3](../frontend/src/index.css#L3) importe `@tailwind components; @tailwind utilities;` — **`@tailwind base` absent** → reset CSS partiel
- 0 utilisation de `dark:bg-…` dans le code (tout passe par CSS vars)
- Sur 28 fichiers TSX de pages, classes Tailwind quasi-jamais utilisées

→ **Décision à prendre** : retirer Tailwind (le système maison se suffit), OU l'adopter à fond. État actuel = poids pour rien.

**Effort :** 2 h (option suppression) · **Impact :** -50 kb bundle, config claire.

---

### V5 — Volume excessif d'inline styles

| Page | Occurrences de `style={{}}` |
|---|---|
| `Eleves/index.tsx` | 124 |
| `Parametres/index.tsx` | 101 |
| `Dashboard.tsx` | 44 |

**Conséquences :**
- Valeurs magiques disséminées (padding `14px 16px` répété sans token)
- Impossible de thématiser (un changement de spacing impose grep+replace)
- Recalcul de style à chaque render
- Lecture JSX difficile

**Fix :** extraction progressive vers classes maison + utilisation des tokens.

---

### V6 — Couleurs hardcodées hors tokens

- [Eleves/index.tsx:188](../frontend/src/pages/Eleves/index.tsx#L188) — `background: '#fff'` → **reste blanc en dark mode**
- [Parametres/index.tsx:103](../frontend/src/pages/Parametres/index.tsx#L103) — toggle switch knob `#fff` fixe
- [Eleves/index.tsx:1135-1136](../frontend/src/pages/Eleves/index.tsx#L1135) — overlay photo `rgba(0,0,0,0.4)` brut

**Fix :** remplacer par `var(--card)`, `var(--paper)`, `var(--ink)` selon contexte.

---

### V7 — Émojis utilisés comme icônes

**8+ occurrences :** `📷` photo (Eleves, Professeurs, Finances, Scanner), `📚` livres (Classes, Matieres), `⚠️` warning (Notes), `🌙 / ☀️` thème (Header).

**Problèmes :**
- Rendu **OS-dependent** (couleur, style différent macOS vs Windows vs Android)
- Pas colorable (impossible de teinter en `--terra`)
- Inconsistant avec 100+ icônes SVG monogrammes du reste

**Fix :** remplacer par SVG (Lucide, Heroicons, ou maison).

---

### V8 — RTL incomplet dans les inline styles

13 occurrences de propriétés physiques (`left:`, `right:`, `paddingLeft`, `marginLeft`) dans `pages/` :

- [Eleves/index.tsx:1585](../frontend/src/pages/Eleves/index.tsx#L1585) — `paddingLeft: 16` (liste erreurs CSV) → en RTL liste alignée du mauvais côté
- [Parametres/index.tsx:103](../frontend/src/pages/Parametres/index.tsx#L103) — toggle switch `left: checked ? 22 : 3` → **knob va dans le mauvais sens** en RTL
- [Finances/index.tsx:124, 797](../frontend/src/pages/Finances/index.tsx#L124) — `marginLeft` au lieu de `marginInlineStart`
- [Documents/index.tsx:321, 322, 325](../frontend/src/pages/Documents/index.tsx#L321) — idem

**Fix :** `paddingLeft` → `paddingInlineStart`, `left:` → `insetInlineStart:`, etc.

---

### V9 — Inline `<style>` brut dans le JSX

[Eleves/index.tsx:171](../frontend/src/pages/Eleves/index.tsx#L171) :
```html
<style>body{font-family:sans-serif;text-align:center;padding:40px}…</style>
```

Style sans portée injecté dans le DOM. Probablement pour un export print/PDF, mais devrait être un fichier dédié ou template HTML séparé.

---

## 🟡 Moyennes (P2) — maturité du design system

### V10 — Pas d'échelle d'espacement (spacing scale)

Espaces hardcodés : `gap: 8`, `padding: '14px 16px'`, `marginTop: 6`, `12px 20px`, `padding: '8px 14px'`. Aucun token.

**Fix :** introduire dans `:root` :
```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 24px;
--space-6: 32px;
--space-7: 48px;
--space-8: 64px;
```

---

### V11 — Pas d'échelle typographique

Tailles dispersées : `11, 10.5, 11.5, 12, 12.5, 13, 13.5, 14, 15, 16, 17, 18, 22, 24, 28, 32, 36, 48`. **18 tailles distinctes**, sans hiérarchie modulaire.

**Fix :**
```css
--text-xs:    11px;
--text-sm:    13px;
--text-base:  15px;
--text-md:    17px;
--text-lg:    22px;
--text-xl:    28px;
--text-2xl:   32px;
--text-3xl:   48px;
```

---

### V12 — Accent unique `terra` sur-utilisé, `sahel`/`indigo` abandonnés

- `--terra` couvre : bouton primaire, lien actif, focus ring, hover, progress bar, badge accent → identité forte mais saturée
- `--sahel` (or, "mention/honneur") et `--indigo` (cachet officiel) **définis mais quasi-inutilisés**

**Opportunités :**
- `sahel` pour les bulletins "Très bien" / "Mention"
- `indigo` pour certificats officiels / cachets / signatures
- Hiérarchie sémantique enrichie

---

### V13 — Contraste WCAG sur la palette claire

À vérifier en outil (ex: [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)) :

| Token | Sur | Ratio estimé | Verdict |
|---|---|---|---|
| `--ink-3 #7A6F5C` | `--paper #FAF6EE` | ~4.0:1 | ⚠️ Sous AA texte normal (4.5 requis) |
| `--ink-4 #A89B82` | `--paper` | ~2.9:1 | ❌ Échoue AA même grand texte |
| `--ink-3 #948A78` | `--paper #1B1812` (dark) | ~5.6:1 | ✅ OK |

`--ink-3` est utilisé partout (`info-label`, `sub`, `sb-tag`, `stat-label`, `crumbs`).

**Fix :** remonter `--ink-3` d'un cran → `#6A604F` passe AA.

---

### V14 — `aria-*` rares

- 7 `aria-label` dans tout le frontend pour ~24 boutons icône-seule
- Topbar : theme toggle, language toggle, profile, search → **aucun aria-label** (juste `title=` HTML natif)
- NotificationBell, command palette trigger : pas d'aria
- Tabs `.tab` n'utilisent ni `role="tab"` ni `aria-selected`

**Impact :** lecteurs d'écran → navigation pratiquement impossible sur ⅔ des contrôles.

**Fix :** audit complet + ajout `aria-label` sur tous les boutons icône.

---

### V15 — Aucun `prefers-reduced-motion`

Animations `fadeIn`, `slideUp`, `spin`, `pulse`, transitions partout, mais aucun :

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Risque vertige pour utilisateurs vestibulaires.

---

### V16 — Tooltips natifs `title=` partout

8+ occurrences dans Topbar / Sidebar / Login / Landing.

**Problèmes du `title` natif :**
- Délai 1 s
- Non stylé
- Non touch (mobile invisible)
- Non RTL
- Peut être tronqué

**Fix :** Tooltip composant (Floating UI, Radix Tooltip).

---

### V17 — Petites tailles de texte fréquentes

Éléments fonctionnels à 11-12px : badges, info-labels, breadcrumbs, sb-tag. WCAG recommande **16px minimum** pour le corps. Pour un produit utilisé par du personnel administratif non-expert, c'est petit.

---

## 🟢 Mineures (P3) — polish

| # | Constat | Référence |
|---|---|---|
| V18 | `kbd` affiche `⌘K` mais pas `Ctrl+K` selon plateforme | [Header.tsx:113](../frontend/src/components/layout/Header.tsx#L113) |
| V19 | Salutation Dashboard utilise `nom_fr.split(' ')[0]` → "Bonjour, FALL." si nom_fr en majuscules | [Dashboard.tsx:109](../frontend/src/pages/Dashboard.tsx#L109) |
| V20 | Aucune **illustration** pour les états vides (`.empty`) | [index.css:702-707](../frontend/src/index.css#L702) |
| V21 | Pas d'apple-touch-icon, ni manifest PWA | [index.html:5](../frontend/index.html#L5) |
| V22 | `Modal` reçoit `style={{ maxWidth: sizeMap[size] }}` au lieu d'une classe modifier | [Modal.tsx:37](../frontend/src/components/ui/Modal.tsx#L37) |
| V23 | `LogoMark` ratio `size * 64/56` → manque variante 16×16 favicon | [LogoMark.tsx:20](../frontend/src/components/ui/LogoMark.tsx#L20) |
| V24 | `--paper #FAF6EE` peut paraître jaunâtre sur écrans non-calibrés | [index.css:8](../frontend/src/index.css#L8) |
| V25 | Pas de Storybook / page de démos | — |
| V26 | Toggle thème affiche émoji `🌙 Sombre` / `☀️ Clair` mélangé avec texte | [Header.tsx:195](../frontend/src/components/layout/Header.tsx#L195) |
| V27 | Sidebar mobile (≤1024px à 72px), logo `sb-mark` 30×30 → planchette illisible | [Sidebar.tsx:125](../frontend/src/components/layout/Sidebar.tsx#L125) |

---

## 🎯 Priorisation

| Priorité | Action | Effort | Impact |
|---|---|---|---|
| 🔴 P0 | **V1** : aliaser les 4 tokens fantômes | 15 min | Corrige ~16 bugs visuels |
| 🔴 P0 | **V2** : ajouter `@keyframes pulse` + `spin` global | 2 min | Skeletons animés |
| 🔴 P0 | **V3** : repeindre `Pointage/Scanner.tsx` aux tokens daara | 1 h | Identité unifiée |
| 🟠 P1 | **V6** : remplacer `#fff` hardcodés par `var(--card)` | 30 min | Dark mode propre |
| 🟠 P1 | **V8** : inline styles → propriétés logiques pour RTL | 1 h | Toggle/listes propres en arabe |
| 🟠 P1 | **V14** : `aria-label` sur boutons icône Topbar | 15 min | Accessibilité lecteurs d'écran |
| 🟠 P1 | **V13** : remonter `--ink-3` à `#6A604F` | 5 min | Conformité WCAG AA |
| 🟠 P1 | **V15** : `@media (prefers-reduced-motion)` | 10 min | Accessibilité moteur |
| 🟡 P2 | **V10** + **V11** : introduire `--space-*` et `--text-*` | 1 j | Cohérence long terme |
| 🟡 P2 | **V12** : utiliser `sahel` (mention) et `indigo` (officiel) | 0.5 j | Hiérarchie sémantique |
| 🟡 P2 | **V7** : remplacer émojis par SVG | 1 h | Cohérence visuelle |
| 🟡 P2 | **V16** : Tooltip composant (Floating UI / Radix) | 0.5 j | UX professionnelle |
| 🟡 P2 | **V17** : audit tailles texte, viser 13px+ pour fonctionnel | 0.5 j | Lisibilité |
| 🟢 P3 | **V4** : décider Tailwind in/out | 2 h | Cohérence stack |
| 🟢 P3 | **V5** : extraire inline styles d'Eleves vers classes | 1 j | Maintenabilité |
| 🟢 P3 | **V20** : illustration daara pour `.empty` | 0.5 j | Identité enrichie |
| 🟢 P3 | **V21** : apple-touch-icon + manifest PWA | 1 h | Mobile / installation |
| 🟢 P3 | **V25** : Storybook pour le design system | 1 j | Doc + tests visuels |

---

## 📊 Verdict design

**Identité graphique de qualité rare** pour un SaaS éducatif. La palette terracotta/papier, les 4 polices typées par rôle, le logo *lawh* racontent une histoire et différencient nettement DaaraGest. La structure CSS (tokens + dark mode + RTL natif) prouve un vrai travail de fond.

Mais l'exécution souffre de **bugs visuels silencieux** (4 tokens non définis = ~16 endroits dégradés), d'un **mélange Tailwind/inline styles/CSS maison** non assumé, et de **lacunes d'accessibilité** facilement corrigeables.

Les correctifs **P0 prennent ~1 h 20** cumulées et hissent immédiatement le rendu à un niveau professionnel **sans rien sacrifier** de l'identité.

Le scanner QR isolé (V3) est l'écart le plus visible : c'est le seul écran que verra le personnel terrain au quotidien, et il ne ressemble pas à DaaraGest.

Une fois P0 + P1 traités (~3 h cumulées), la qualité visuelle atteint **9/10** — le produit aurait un design solide, accessible, et culturellement unique.
