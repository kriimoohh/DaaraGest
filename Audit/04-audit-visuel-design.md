# 04 — Audit Visuel & Design

> Périmètre : système de design (tokens, palette, typo), composants UI, layouts, landing page, dark mode, RTL, accessibilité (WCAG).

**Note globale : 8.5/10** (↑ de 7.5/10) — tous les P0 critiques (tokens fantômes, animations, Scanner identitaire) sont corrigés. Reste l'inflation des inline styles et l'absence d'échelles centralisées (spacing, typo).

---

## ✅ Acquis depuis l'audit précédent (2026-05-19)

| Ancien constat | État | Référence |
|---|---|---|
| V1 — Variables CSS fantômes (4 tokens non définis) | ✅ **Corrigé** | [index.css:76-80](../frontend/src/index.css#L76) — alias `--surface-2 → --paper-2`, `--border → --rule`, `--radius → --r-md`, `--text-muted → --ink-3` |
| V2 — `@keyframes pulse` manquant | ✅ **Corrigé** | [index.css:670](../frontend/src/index.css#L670) — `@keyframes pulse` + `@keyframes spin` globaux |
| V3 — Scanner.tsx hors design system | ✅ **Corrigé** | [Pointage/Scanner.tsx](../frontend/src/pages/Pointage/Scanner.tsx) — 0 occurrences de la palette Tailwind slate/blue, utilise désormais `var(--paper)`, `var(--card)`, `var(--success)`, `var(--info)`, `var(--warning)`, `var(--danger)` |
| V13 — Contraste WCAG `--ink-3` | ✅ **Corrigé** | [index.css:18-19](../frontend/src/index.css#L18) — `--ink-3: #6A604F` (4.51:1 AA), `--ink-4: #8C7E66` (3.06:1 AA grand texte). Commentaire WCAG inline |
| V15 — Pas de `prefers-reduced-motion` | ✅ **Corrigé** | [index.css:675-682](../frontend/src/index.css#L675) — `@media (prefers-reduced-motion: reduce)` désactive animations/transitions |
| V14 — `aria-label` rares | 🟡 **Partiellement** | 13 occurrences `aria-label` dans le frontend. Boutons critiques (Modal close, Burger, Toast close) couverts, mais Topbar/Tabs/Sidebar/NotificationBell encore minces |

## 🆕 Détails du nouveau système

- **47 variables CSS** définies dans `:root` + **36 inversions** dans `[data-theme="dark"]`
- **Palette enrichie** : terra (terracotta), sahel (or), indigo (cachet) — 3 axes accent
- **5 radius** (`--r-xs` à `--r-xl`), 3 shadows (sm/md/lg), 2 layout (sidebar/topbar)
- **4 polices** : Fraunces (display), Instrument Sans (UI), JetBrains Mono (matricules), Noto Naskh (RTL)
- **9 variantes de Badge**, 5 variants × 3 sizes pour Button, Modal a11y-safe (Escape + scroll-lock)

---

## ✅ Points forts inchangés

- **Identité graphique singulière** : terracotta + papier chaud + encre brune, référence visuelle au *daara*
- **Dark mode complet** — 36 variables inversées, basculement fluide via `data-theme` ([useTheme.ts](../frontend/src/hooks/useTheme.ts)), synchronisé DB
- **RTL natif** — propriétés logiques (`border-inline-end`, `inset-inline-start`), polices switchées automatiquement, sidebar et grille `app` inversent leurs colonnes ([index.css:138-140](../frontend/src/index.css#L138))
- **Responsive 3 paliers** — ≤1024 px sidebar collapse 72 px, ≤640 px drawer + burger, `@media print`
- **Composants UI propres** — Button, Modal, Table (avec skeleton), Badge, Toast, ActionMenu, NotificationBell, PhotoPicker, ConfirmModal

---

## 🟠 Hautes (P1) restantes

### V1 — Inline styles toujours massifs (aggravation)
**Volume actuel :**

| Page | Occurrences `style={{` | Δ vs audit précédent |
|---|---|---|
| [Eleves/index.tsx](../frontend/src/pages/Eleves/index.tsx) | **125** | +1 |
| [Parametres/index.tsx](../frontend/src/pages/Parametres/index.tsx) | **110** | +9 |
| [Documents/index.tsx](../frontend/src/pages/Documents/index.tsx) | **94** | nouveau |
| [Dashboard.tsx](../frontend/src/pages/Dashboard.tsx) | 44 | = |
| [Classes/index.tsx](../frontend/src/pages/Classes/index.tsx) | 40 | nouveau mesure |

**Conséquences :**
- Valeurs magiques disséminées (`padding: '14px 16px'`, `gap: 8`, `marginTop: 6`)
- Impossible de thématiser (un changement de spacing impose un grep+replace)
- Recalcul de style à chaque render
- Lecture JSX difficile

**Fix :** extraction progressive vers classes maison + utilisation des tokens (voir V5/V6 ci-dessous).

**Effort :** 1 j par page · **Impact :** maintenabilité long terme.

---

### V2 — Pas d'échelle d'espacement (`--space-*`)
Toujours pas de variables centralisées. Espaces hardcodés partout : `gap: 8`, `padding: '14px 16px'`, `marginTop: 6`, `padding: '8px 14px'`.

**Fix :** introduire dans `:root` :
```css
:root {
  --space-1: 4px;   --space-2: 8px;
  --space-3: 12px;  --space-4: 16px;
  --space-5: 24px;  --space-6: 32px;
  --space-7: 48px;  --space-8: 64px;
}
```

Et migrer progressivement les inline styles vers ces variables.

**Effort :** 1 h pour les définitions + 1 j de migration sur 5 pages · **Impact :** cohérence long terme.

---

### V3 — Pas d'échelle typographique (`--text-*`)
Tailles dispersées sans hiérarchie : `11, 10.5, 11.5, 12, 12.5, 13, 13.5, 14, 15, 16, 17, 18, 22, 24, 28, 32, 36, 48`. **18+ tailles distinctes**.

**Fix :**
```css
:root {
  --text-xs:    11px;
  --text-sm:    13px;
  --text-base:  15px;
  --text-md:    17px;
  --text-lg:    22px;
  --text-xl:    28px;
  --text-2xl:   32px;
  --text-3xl:   48px;
}
```

**Effort :** 1 h définition + migration progressive · **Impact :** hiérarchie claire.

---

### V4 — Calendrier hors palette daara
[EmploiDuTemps/index.tsx](../frontend/src/pages/EmploiDuTemps/index.tsx) — usage de couleurs Tailwind blue/green pour distinguer filières (`#BFDBFE`, `#BBF7D0`, `#EFF6FF`, `#F0FDF4`, `#15803D`, `#1D4ED8`). Aucun rapport avec la palette daara (terra/sahel/indigo).

**Fix :** repeindre aux tokens :
- Filière FR → `var(--info-soft)` / `var(--info-text)` (indigo)
- Filière AR → `var(--sahel-soft)` / `var(--sahel-ink)` (or)
- Activités → `var(--terra-soft)` / `var(--terra-ink)`

**Effort :** 1 h · **Impact :** identité unifiée sur le calendrier.

---

### V5 — `#fff` et autres couleurs hardcodées
- 46 occurrences `'#fff'` ou `"#fff"` dans `pages/` — souvent backgrounds qui restent blancs en dark mode
- Couleur de marque ailleurs : `#3F7A4D`, `#A8331F`, `#B85433` utilisées en dur au lieu de `var(--success)`, `var(--danger)`, `var(--terra)`

**Fix :** find-and-replace progressif vers tokens. Garder uniquement les couleurs purement décoratives (icônes SVG inline).

**Effort :** 1 h ciblé sur les `#fff` · **Impact :** dark mode propre.

---

### V6 — Accessibilité ARIA encore minime (P1)
- Seulement **13 occurrences** `aria-label` dans tout le frontend
- **0 occurrence** `role="tab"` / `aria-selected` pour les onglets
- **0 occurrence** `role="dialog"` explicite sur Modal (mais Modal gère bien Escape + scroll-lock)
- Topbar : theme toggle, language toggle, profile, search — encore juste `title=` natif
- NotificationBell, command palette trigger : pas d'aria

**Impact :** lecteurs d'écran → navigation impossible sur ⅔ des contrôles.

**Fix :** audit complet + ajout `aria-label` sur tous les boutons icône + `role="tablist"`/`role="tab"`/`aria-selected` sur les onglets.

**Effort :** 0.5 j · **Impact :** accessibilité lecteurs d'écran.

---

## 🟡 Moyennes (P2) — maturité du design system

### V7 — Tailwind décision toujours pas prise
- [tailwind.config.ts](../frontend/tailwind.config.ts) configure tokens custom
- [index.css:3-4](../frontend/src/index.css#L3) importe `@tailwind components; @tailwind utilities;` — **`@tailwind base` toujours absent**
- 0 utilisation observable de `dark:bg-…` dans le code (tout passe par CSS vars)
- Classes Tailwind quasi-jamais utilisées dans les pages

État actuel = **poids pour rien** dans le bundle.

**Décision à arbitrer :**
- **Option A** : retirer Tailwind, le système maison se suffit (-50 kb bundle, config claire)
- **Option B** : adopter à fond, migrer les inline styles vers utilities

**Effort A :** 2 h · **Effort B :** 5-7 j · **Impact :** cohérence stack.

---

### V8 — Sahel (or) et Indigo encore quasi-inutilisés
[index.css:28-33](../frontend/src/index.css#L28) — palette riche définie mais :
- `--sahel` : 1 occurrence index.css, ~0 utilisation effective dans composants
- `--indigo` : 9 occurrences mais surtout en équivalent `--info-*`

**Opportunités manquées :**
- `sahel` pour les bulletins "Très bien" / "Mention" / "Félicitations"
- `indigo` pour certificats officiels / cachets / signatures
- Hiérarchie sémantique enrichie

**Effort :** 0.5 j · **Impact :** différenciation sémantique riche.

---

### V9 — Pas de composant Tooltip
[Header.tsx](../frontend/src/components/layout/Header.tsx), Sidebar, Login, Landing : 8+ occurrences `title=` natif.

**Problèmes du `title` natif :**
- Délai 1 s
- Non stylé
- Invisible sur touch (mobile)
- Non RTL
- Tronqué arbitrairement par OS

**Fix :** composant `Tooltip` maison (Floating UI / Radix Tooltip).

**Effort :** 0.5 j · **Impact :** UX professionnelle desktop + mobile.

---

### V10 — Pas de manifest PWA / apple-touch-icon
[index.html](../frontend/index.html) — favicon SVG seul. Pas de :
- `manifest.json` dans `public/`
- `<link rel="apple-touch-icon">`
- `<link rel="manifest">`
- Theme color meta

**Impact :** ajout à l'écran d'accueil iOS/Android non géré, pas installable comme PWA.

**Fix :** créer `frontend/public/manifest.json` + icônes 180×180, 192×192, 512×512.

**Effort :** 1 h · **Impact :** mobile / installation.

---

### V11 — Petites tailles de texte fréquentes
Éléments fonctionnels à 11–12 px : badges, info-labels, breadcrumbs, sb-tag. WCAG recommande **16 px minimum** pour le corps. Pour un produit utilisé par du personnel administratif non-expert, c'est petit — surtout en arabe Naskh où la lisibilité dépend plus de la taille.

**Fix :** audit ciblé, viser 13 px+ pour fonctionnel, 15 px pour corps.

**Effort :** 0.5 j · **Impact :** lisibilité.

---

### V12 — Émojis comme indicateurs (V7 ancien)
20 occurrences globales : `✓`, `✗`, `⚠`, etc. (Scanner, LandingPage feedback). Moins qu'avant (l'audit précédent comptait 8+ icônes émojis 📷📚⚠️🌙☀️) — la migration est partielle.

**Problèmes restants :**
- Rendu OS-dependent
- Non colorable (impossible de teinter en `--terra`)
- Inconsistant avec 100+ icônes SVG monogrammes du reste

**Fix :** remplacer par SVG (Lucide, Heroicons, ou maison).

**Effort :** 1 h · **Impact :** cohérence visuelle.

---

## 🟢 Mineures (P3) — polish

| # | Constat | Référence |
|---|---|---|
| V13 | `kbd` affiche `⌘K` mais pas `Ctrl+K` selon plateforme | [Header.tsx:113](../frontend/src/components/layout/Header.tsx#L113) |
| V14 | Salutation Dashboard utilise `nom_fr.split(' ')[0]` → "Bonjour, FALL." si nom_fr en majuscules | [Dashboard.tsx](../frontend/src/pages/Dashboard.tsx) |
| V15 | Aucune **illustration** pour les états vides (`.empty`) | [index.css](../frontend/src/index.css) |
| V16 | `Modal` reçoit `style={{ maxWidth: sizeMap[size] }}` au lieu d'une classe modifier | [Modal.tsx](../frontend/src/components/ui/Modal.tsx) |
| V17 | `LogoMark` ratio `size * 64/56` → manque variante 16×16 favicon | [LogoMark.tsx](../frontend/src/components/ui/LogoMark.tsx) |
| V18 | `--paper #FAF6EE` peut paraître jaunâtre sur écrans non-calibrés | [index.css:8](../frontend/src/index.css#L8) |
| V19 | Pas de Storybook / page de démos du design system | — |
| V20 | Sidebar mobile (≤1024 px à 72 px), logo `sb-mark` 30×30 → planchette illisible | [Sidebar.tsx](../frontend/src/components/layout/Sidebar.tsx) |
| V21 | Quelques `paddingLeft / left:` inline subsistent (RTL imparfait dans Documents/index.tsx) | [Documents/index.tsx](../frontend/src/pages/Documents/index.tsx) |
| V22 | Pas d'animation skeleton sur Cards/grilles (juste Table) | [Table.tsx:27](../frontend/src/components/ui/Table.tsx#L27) |

---

## 🎯 Priorisation

| Priorité | Action | Effort | Impact |
|---|---|---|---|
| 🟠 P1 | **V6** : `aria-label` Topbar + `role="tab"`/`aria-selected` Tabs | 0.5 j | Accessibilité lecteurs d'écran |
| 🟠 P1 | **V5** : remplacer les 46 `#fff` hardcodés par `var(--card)` | 1 h | Dark mode propre |
| 🟠 P1 | **V4** : repeindre EmploiDuTemps aux tokens | 1 h | Identité unifiée |
| 🟠 P1 | **V2** : introduire `--space-*` (définitions seules) | 1 h | Préparer migration |
| 🟠 P1 | **V3** : introduire `--text-*` (définitions seules) | 1 h | Préparer migration |
| 🟡 P2 | **V7** : décider Tailwind in/out | 2 h | Cohérence stack |
| 🟡 P2 | **V8** : sahel pour mentions, indigo pour cachets | 0.5 j | Hiérarchie sémantique |
| 🟡 P2 | **V9** : composant Tooltip (Floating UI / Radix) | 0.5 j | UX professionnelle |
| 🟡 P2 | **V11** : audit tailles texte, viser 13 px+ | 0.5 j | Lisibilité |
| 🟡 P2 | **V12** : émojis → SVG | 1 h | Cohérence visuelle |
| 🟡 P2 | **V10** : manifest PWA + apple-touch-icon | 1 h | Mobile / installation |
| 🟢 P3 | **V1** : extraire inline styles d'Eleves vers classes | 1 j | Maintenabilité |
| 🟢 P3 | **V15** : illustration daara pour `.empty` | 0.5 j | Identité enrichie |
| 🟢 P3 | **V19** : Storybook pour le design system | 1 j | Doc + tests visuels |

---

## 📊 Verdict design

**Identité graphique de qualité rare** confirmée. Tous les **P0 critiques** du précédent audit sont corrigés : les tokens fantômes (`--surface-2`, `--border`, `--radius`, `--text-muted`) sont aliasés proprement, `@keyframes pulse`/`spin` sont globaux, le Scanner QR (`Pointage/Scanner.tsx`) a été repeint aux tokens daara, `--ink-3` respecte WCAG AA, et `prefers-reduced-motion` est respecté.

**Le rendu visuel à HEAD est cohérent et professionnel.** Les Sprints "design polish + a11y" ont fait leur œuvre.

Restent deux dettes structurelles distinctes :
- **Inflation des inline styles** : Eleves +1, Parametres +9, Documents nouveau 94 occurrences. Sans **échelles `--space-*` / `--text-*`** centralisées, chaque ajout de feature ajoute des valeurs magiques disséminées
- **Accessibilité partielle** : `aria-label` à 13 occurrences seulement, tabs sans `role`, Topbar sans labels

Les correctifs **P1 (~6 h cumulées)** hissent l'expérience à un niveau **9.5/10** sans effort déraisonnable. La décision Tailwind (V7) reste à arbitrer côté produit avant l'industrialisation d'une bibliothèque de composants.
