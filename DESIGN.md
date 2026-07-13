# Design

Système visuel de DaaraGest. Source de vérité : `frontend/src/index.css` (tokens + classes composants) et `frontend/tailwind.config.ts` (mapping Tailwind → variables CSS). Thème clair par défaut, thème sombre via `html[data-theme="dark"]`, RTL via `html[dir="rtl"]`.

## Couleurs (tokens CSS)

| Rôle | Token | Clair | Usage |
|---|---|---|---|
| Fond page | `--paper` | `#FAF6EE` | body, fonds de page |
| Fond secondaire | `--paper-2` / `--paper-3` | `#F3ECDD` / `#E9DFC9` | hovers, filtres, en-têtes de table |
| Carte | `--card` | `#FFFFFF` | cartes, modales, sidebar |
| Bordures | `--rule` / `--rule-2` | `#E0D5BD` / `#C9BB9D` | séparateurs, bordures |
| Texte | `--ink` → `--ink-4` | `#1B1812` → `#8C7E66` | hiérarchie du texte (`--ink-3` = AA sur paper) |
| Accent | `--terra` / `--terra-deep` / `--terra-soft` / `--terra-ink` | `#B85433`… | actions primaires, sélection, focus |
| Nobles | `--sahel` (or), `--indigo` | `#C8932B`, `#2D3A6E` | badges catégoriels, data viz |
| Sémantiques | `--success*`, `--warning*`, `--danger*`, `--info*` | — | états ; chaque famille a `-soft`, `-text`, `-border` |

Règle : **aucun hex en dur dans les pages** (exception : templates d'impression PDF ouverts hors app, et surfaces caméra/photo volontairement sombres).

## Typographie

- Display : **Fraunces** (titres de page, valeurs de stats, en-têtes de modales) — `.font-display`.
- UI : **Instrument Sans** (tout le reste).
- Mono : **JetBrains Mono** (matricules, montants, labels uppercase, kbd).
- Arabe : **Noto Naskh Arabic** (auto via `html[dir="rtl"]`).
- Échelle : `--text-xs` 11 → `--text-3xl` 48 ; base 15px / 1.55.

## Composants (classes CSS + composants React `components/ui/`)

- Boutons : `.btn` + `.btn-primary|secondary|ghost|danger` + `.btn-sm|lg|icon` → composant `Button` (variants, loading, icon).
- Badges : `.badge` + `.badge-success|warning|danger|info|neutral|accent|outline|sahel|indigo` → composant `Badge`.
- Tableaux : `.card > .tbl-wrap > .tbl` (th uppercase mono, zébrage au hover) → composant `Table` (tri, skeleton, empty).
- Formulaires : `.field > .field-label + .input/.select` → composants `Input`, `Select` ; textarea = `textarea.input`.
- Modales : `.modal-backdrop > .modal > .modal-hd/.modal-body/.modal-foot` → composants `Modal`, `ConfirmModal`.
- Page : `PageHeader` (`.page-head`, `.page-eyebrow`, `.page-title`), `.card-hd`, `.stat`, `.tabs/.tab`, `.filter-row`, `.empty`, `.info-label/.info-value`, `.pagination`.
- Pattern « segmented pills » (période, statut, format) : boutons inline arrondis, actif = fond `--terra` + texte blanc, inactif = `--paper-2` + `--ink`/`--ink-3`.

## Layout

- App shell : grid `sidebar (248px) + main`, topbar sticky 56px, contenu max 1440px, padding 28/32.
- Breakpoints : 1024px (sidebar icônes), 640px (sidebar drawer + burger, grilles 1 colonne).
- Espacement : échelle 4/8 (`--space-1..8`).
- Radii : 4/6/8/12/18 (`--r-xs..xl`) — jamais plus de 18px.

## Motion

Transitions 120–200ms ease, `fadeIn`/`slideUp` sur modales et toasts, `pulse` sur skeletons. `prefers-reduced-motion` neutralise tout globalement.

## Interdits observés dans le projet (à ne pas réintroduire)

- Palette Tailwind gray/blue en dur (`#6b7280`, `#e5e7eb`, `#2563eb`…) — casse thème sombre et identité.
- Couleurs Bootstrap (`#fff3cd`, `#d1e7dd`, `#f8d7da`).
- Tableaux à en-tête coloré plein (hors templates d'impression).
- `margin-left/right` directionnels là où `margin-inline-*` s'impose (RTL).
