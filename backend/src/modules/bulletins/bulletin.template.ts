import { escapeHtml } from '../../utils/escapeHtml';
import { DEFAULT_NOTE_MAX } from '../../utils/notes';
import { renderMicroTemplate } from '../../utils/microTemplate';

// ─── Types ──────────────────────────────────────────────────────────────────

interface NoteRow {
  nom_fr: string;
  nom_ar: string;
  coeff: number;
  valeur: number | null;
  note_max?: number;
  // false = matière enseignée mais non évaluée → mention dédiée, hors moyenne.
  evaluee?: boolean;
}

interface TrimestreRow {
  nom_fr: string;
  nom_ar: string;
  coeff: number;
  note_max?: number;
  valeurs: (number | null)[];
  moyenne_annuelle: number | null;
  evaluee?: boolean;
}

interface BulletinBaseData {
  etablissement_nom_fr: string;
  etablissement_logo_url?: string | null;
  entete_bulletin_fr?: string | null;
  entete_bulletin_ar?: string | null;
  eleve_nom_fr: string;
  eleve_matricule: string;
  eleve_date_naissance?: string | null;
  eleve_lieu_naissance?: string | null;
  annee_libelle: string;
  moyenne: number | null;
  rang: number | null;
  appreciation: string | null;
  devise: string;
  note_max_etab?: number;
  // Échelle d'affichage de la filière (phase 3) — mono-filière uniquement. Absent /
  // égal à l'échelle établissement = aucun re-scale. Non fourni pour le combiné.
  echelle_affichage?: number;
  mentions?: { libelle_fr: string; libelle_ar?: string | null; seuil_min: number }[];
  // Contact établissement (bandeau sous l'en-tête) + maître(s) de la classe.
  etablissement_telephone?: string | null;
  etablissement_email?: string | null;
  etablissement_autorisation?: string | null;
  maitre_fr?: string | null;
  maitre_ar?: string | null;
  // Absences cumulées sur l'année scolaire (justifiées / non justifiées).
  absences_justifiees?: number;
  absences_non_justifiees?: number;
  // Réglages de rendu (panneau Paramètres → Bulletins). Absents = valeurs par défaut.
  afficher_rang?: boolean;      // défaut true → colonne Rang visible
  afficher_absences?: boolean;  // défaut true → tableau des absences visible
  logo_echelle?: number;        // % (100 = taille de base)
  nb_periodes?: number;         // pour le titre du bulletin annuel
  noms_periodes?: { fr?: string[] }; // noms FR personnalisés des périodes (config)
  // Modèle HTML personnalisé (Étape 2). Absent → DEFAULT_BULLETIN_TEMPLATE.
  // Le corps contient des placeholders de blocs ({{en_tete}}, {{tableau_notes}}…).
  template_html?: string | null;
}

// Libellé d'une matière, avec sa traduction arabe à côté (filière arabe) quand
// une vraie traduction existe (nom_ar différent de nom_fr).
function matiereLabel(nom_fr: string, nom_ar: string | undefined, bilingue: boolean): string {
  const fr = escapeHtml(nom_fr);
  if (bilingue && nom_ar && nom_ar !== nom_fr) {
    // FR à gauche, nom arabe collé à la bordure droite de la case.
    return `<span style="display:flex;justify-content:space-between;gap:10px;align-items:baseline"><span>${fr}</span><span dir="rtl" style="color:#4b5563;font-weight:400;white-space:nowrap">${escapeHtml(nom_ar)}</span></span>`;
  }
  return fr;
}

// Échelle d'AFFICHAGE de la moyenne (RENDER_BASE) — établissement par défaut, ou
// échelle de la filière (Filiere.note_max) pour un bulletin mono-filière (phase 3).
// Le calcul reste CANONIQUE (base établissement) ; RENDER_FACTOR = RENDER_BASE /
// base établissement re-scale la moyenne stockée + les seuils de mention à
// l'affichage. Combiné → facteur 1 (base canonique). Tout est proportionnel donc
// le classement ne change jamais.
type MentionRow = { libelle_fr: string; libelle_ar?: string | null; seuil_min: number };
let RENDER_BASE = DEFAULT_NOTE_MAX;
let RENDER_FACTOR = 1;
let RENDER_MENTIONS: MentionRow[] = [];
function setRenderContext(d: { note_max_etab?: number; echelle_affichage?: number; mentions?: MentionRow[] }) {
  const etabBase = d.note_max_etab ?? DEFAULT_NOTE_MAX;
  RENDER_BASE = d.echelle_affichage ?? etabBase;
  RENDER_FACTOR = etabBase > 0 ? RENDER_BASE / etabBase : 1;
  // Les seuils de mention sont stockés sur la base établissement → re-scale à l'échelle d'affichage.
  RENDER_MENTIONS = (d.mentions ?? [])
    .map(m => ({ ...m, seuil_min: m.seuil_min * RENDER_FACTOR }))
    .sort((a, b) => b.seuil_min - a.seuil_min);
}
// Mention (objet) pour une valeur ramenée sur l'échelle établissement (RENDER_BASE).
function mentionRowFor(scaled: number | null): MentionRow | null {
  if (scaled === null) return null;
  for (const m of RENDER_MENTIONS) if (scaled + 1e-9 >= m.seuil_min) return m;
  return RENDER_MENTIONS.length ? RENDER_MENTIONS[RENDER_MENTIONS.length - 1] : null;
}
// Libellé FR de la mention (appréciation par matière).
function mentionFor(scaled: number | null): string {
  return mentionRowFor(scaled)?.libelle_fr ?? '';
}
// Libellé bilingue FR + AR de la mention (résumé / mention générale).
function mentionForBilingue(scaled: number | null): string {
  const m = mentionRowFor(scaled);
  if (!m) return '';
  const fr = escapeHtml(m.libelle_fr);
  return m.libelle_ar ? `${fr} <span dir="rtl">/ ${escapeHtml(m.libelle_ar)}</span>` : fr;
}
// Libellé AR d'une appréciation FR déjà calculée (ex. « Bien » → « جيد »),
// retrouvé par correspondance dans les mentions configurées. Vide si absent.
function appreciationArFor(fr: string): string {
  return RENDER_MENTIONS.find(m => m.libelle_fr === fr)?.libelle_ar ?? '';
}
// Moyenne pondérée normalisée sur l'échelle établissement (notes saisies sur leur barème).
// Les matières non évaluées (evaluee === false) sont exclues du calcul.
function moyenneNorm(notes: { valeur: number | null; coeff: number; note_max?: number; evaluee?: boolean }[]): number | null {
  const withVal = notes.filter(n => n.valeur !== null && n.evaluee !== false);
  const totalCoeff = withVal.reduce((s, n) => s + n.coeff, 0);
  if (totalCoeff === 0) return null;
  const pts = withVal.reduce((s, n) => s + (n.valeur! / (n.note_max || RENDER_BASE)) * RENDER_BASE * n.coeff, 0);
  return pts / totalCoeff;
}

export interface BulletinTrimestreData extends BulletinBaseData {
  type: 'FR' | 'AR' | 'EN' | 'COMBINE';
  periode: number;
  notes_fr?: NoteRow[];
  notes_ar?: NoteRow[];
  notes_en?: NoteRow[];
  // COMBINE : codes des filières à fusionner (défaut ['FR','AR']). Généralise le
  // combiné franco-arabe à toute combinaison de filières actives (FR+EN, FR+AR+EN…).
  filieres_combine?: string[];
}

export interface BulletinAnnuelData extends BulletinBaseData {
  type: 'ANNUEL_FR' | 'ANNUEL_AR' | 'ANNUEL_EN' | 'ANNUEL_COMBINE';
  matieres_fr?: TrimestreRow[];
  matieres_ar?: TrimestreRow[];
  matieres_en?: TrimestreRow[];
  filieres_combine?: string[];
}

// ─── Constantes ─────────────────────────────────────────────────────────────

// Nom d'une période (COMPLET, plus de « T1/T2/T3 ») selon le découpage de
// l'établissement : 2 = semestres, 6 = bimestres, sinon trimestres. Un nom FR
// personnalisé (ConfigNotes.noms_periodes.fr) est prioritaire. L'arabe utilise
// « الاختبار » + l'ordinal (traductions fournies par l'établissement).
const ORDINAL_FR = ['1er', '2ème', '3ème', '4ème', '5ème', '6ème'];
const ORDINAL_AR = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'];
const motPeriode = (nbPeriodes: number) =>
  nbPeriodes === 2 ? 'Semestre' : nbPeriodes === 6 ? 'Bimestre' : 'Trimestre';

function periodeNomFr(p: number, nbPeriodes: number, noms?: string[]): string {
  const custom = noms?.[p - 1];
  if (custom && custom.trim()) return custom;
  return `${ORDINAL_FR[p - 1] ?? `${p}ème`} ${motPeriode(nbPeriodes)}`;
}
function periodeNomAr(p: number): string {
  return ORDINAL_AR[p - 1] ? `الاختبار ${ORDINAL_AR[p - 1]}` : `الفترة ${p}`;
}

// Appréciation par matière = mentions configurées de l'établissement (mêmes bandes
// que la moyenne, ex /10 : Très bien≥10, Bien≥8…), appliquées à la note ramenée
// sur l'échelle établissement. Les bulletins sont strictement en français,
// y compris pour la filière arabe.
function getApprNom(note: number | null, noteMax: number): string {
  if (note === null) return '';
  if (RENDER_MENTIONS.length) return mentionFor(noteMax > 0 ? (note / noteMax) * RENDER_BASE : 0);
  const pct = noteMax > 0 ? note / noteMax : 0; // fallback si aucune mention configurée
  if (pct >= 0.8) return 'Très bien';
  if (pct >= 0.7) return 'Bien';
  if (pct >= 0.6) return 'Assez bien';
  if (pct >= 0.5) return 'Passable';
  return 'Insuffisant';
}

function apprClass(note: number | null, noteMax: number): string {
  if (note === null) return '';
  const pct = note / noteMax;
  if (pct >= 0.8) return 'appr-tb';
  if (pct >= 0.7) return 'appr-b';
  if (pct >= 0.6) return 'appr-ab';
  if (pct >= 0.5) return 'appr-p';
  return 'appr-ins';
}

// ─── CSS commun ─────────────────────────────────────────────────────────────

export const CSS = `
/* Police arabe Naskh dédiée (lisible pour un document officiel). Le latin reste
   en Arial ; l'arabe, absent d'Arial, retombe sur Noto Naskh Arabic. Chargée au
   rendu (réseau dispo, cf. logo distant) ; à défaut, repli sur la police système. */
@import url('https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;700&display=swap');
* { margin:0;padding:0;box-sizing:border-box }
body { font-family:Arial,'Noto Naskh Arabic',sans-serif;font-size:12.5px;color:#111;padding:18px 28px }

/* ── En-tête ── */
.header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px }
.header-top { display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:4px }
.entete-text { font-size:10.5px;color:#374151;line-height:1.3;flex:1 }
.entete-fr { text-align:left }
/* Arabe : couleur sombre pour la visibilité, mais graisse NORMALE (le gras
   casse le rendu/chaînage des glyphes arabes) et taille mesurée (pas « grosse »).
   La lisibilité vient surtout de la police Noto Naskh Arabic (cf. @import). */
.entete-ar { text-align:right;direction:rtl;font-size:11.5px;color:#1f2937;line-height:1.5 }
.header-logo { flex-shrink:0;align-self:center }
.school-name-line { text-align:center;font-size:15px;font-weight:bold;color:#0F172A;text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px }
.school-block { flex:1 }
.school-name { font-size:15px;font-weight:bold;color:#0F172A;text-transform:uppercase;letter-spacing:.3px }
.school-name-ar { font-size:13px;color:#374151;direction:rtl;margin-top:2px }
.header-date { font-size:11px;color:#374151;white-space:nowrap;padding-top:2px }
.divider { border:none;border-top:2.5px solid #B85433;margin:6px 0 8px }

/* ── Titre principal ── */
.doc-title-wrap { border:2px solid #0F172A;border-radius:4px;margin-bottom:8px;overflow:hidden }
.doc-title-main { background:#0F172A;color:#fff;text-align:center;padding:4px 10px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.4px }

/* ── Bandeau contact école ── */
.school-band { display:flex;justify-content:center;flex-wrap:wrap;gap:3px 18px;font-size:10px;color:#374151;margin-bottom:7px;padding:3px 8px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px }
.school-band b { color:#0F172A;font-weight:700 }

/* ── Infos élève ── */
.student-info { display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;margin-bottom:8px;border:1px solid #d1d5db;border-radius:6px;padding:6px 14px }
.si-row { display:flex;gap:6px;align-items:baseline }
.si-label { font-weight:700;font-size:11px;white-space:nowrap }
.si-value { font-size:12px;border-bottom:1px dotted #9ca3af;flex:1;min-width:80px }

/* ── Tableau d'évaluation ── */
.eval-section { margin-bottom:9px }
.eval-header { background:#0F172A;color:#fff;text-align:center;padding:3px 8px;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;border-radius:4px 4px 0 0 }
table { width:100%;border-collapse:collapse }
thead { background:#f0fdf4 }
th { padding:4px 8px;text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#374151;border-bottom:2px solid #10B981;border-right:1px solid #d1d5db }
th:last-child { border-right:none }
td { padding:3px 8px;border-bottom:1px solid #e5e7eb;border-right:1px solid #f3f4f6;font-size:12px;line-height:1.25 }
td:last-child { border-right:none }
tr:last-child td { border-bottom:none }
tr:nth-child(even) { background:#f9fafb }
.center { text-align:center }
.grade { font-weight:700;font-size:13px }
.pass { color:#059669 }
.fail { color:#dc2626 }
.appr-tb { color:#059669;font-size:10px }
.appr-b  { color:#2563eb;font-size:10px }
.appr-ab { color:#7c3aed;font-size:10px }
.appr-p  { color:#d97706;font-size:10px }
.appr-ins{ color:#dc2626;font-size:10px }

/* ── Ligne de résultats ── */
.results-row td { background:#0F172A;color:#fff;font-weight:700;font-size:11px;border-bottom:none;border-right:1px solid #374151 }
.results-row td:last-child { border-right:none }

/* ── Section combinée ── */
.section-label { font-size:10.5px;font-weight:700;padding:4px 8px;margin-bottom:-1px;border-radius:4px 4px 0 0;display:inline-block }
.section-fr { background:#f0fdf4;color:#059669;border:1px solid #10B981 }
.section-ar { background:#ecfdf5;color:#065f46;border:1px solid #10B981;direction:rtl;float:right }

/* ── Résumé (combiné) ── */
.combined-summary { width:100%;border-collapse:collapse;margin-top:8px;border:1.5px solid #0F172A;border-radius:4px;overflow:hidden }
.combined-summary th { background:#0F172A;color:#fff;padding:3px 6px;font-size:10.5px;text-align:center;border-right:1px solid #374151;text-transform:uppercase }
.combined-summary td { padding:4px 6px;text-align:center;font-size:12px;border-right:1px solid #d1d5db;border-top:1px solid #d1d5db }
.combined-summary td:last-child, .combined-summary th:last-child { border-right:none }
.mention-cell { font-weight:700;font-size:13px }
.th-ar { font-weight:400;font-size:10px;opacity:1 }

/* ── Boîte appréciation ── */
.appreciation-box { border:1px solid #e5e7eb;border-radius:6px;padding:6px 12px;background:#fafafa;margin:8px 0 }
.appreciation-label { font-size:9.5px;color:#6b7280;text-transform:uppercase;margin-bottom:3px }
.observation-line { border-bottom:1px solid #d1d5db;min-height:18px;margin-top:8px }

/* ── Pied de page ── */
.footer-date { text-align:right;font-size:10.5px;color:#374151;margin-top:8px }
.footer { display:flex;justify-content:space-between;margin-top:8px;padding-top:10px;border-top:1.5px solid #e5e7eb }
.signature-box { text-align:center;min-width:110px }
.signature-line { width:110px;border-bottom:1px solid #374151;margin:18px auto 4px }
.signature-label { font-size:9.5px;color:#374151;font-weight:600 }
.footer-brand { text-align:center;font-size:9px;color:#9ca3af;align-self:flex-end;padding-bottom:2px }
.gold-dot { display:inline-block;width:6px;height:6px;border-radius:50%;background:#F59E0B;margin:0 3px }
`;

// ─── Header commun ─────────────────────────────────────────────────────────

// Mark générique « lawh + Dg ». Dimensionné dynamiquement (viewBox 56×64).
function logoMarkSvg(hauteurPx: number): string {
  const w = Math.round((hauteurPx * 56) / 64);
  return `<svg width="${w}" height="${hauteurPx}" viewBox="0 0 56 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
  <rect x="20" y="0" width="16" height="8" rx="4" fill="#B85433"/>
  <rect x="4" y="6" width="48" height="52" rx="6" fill="#B85433"/>
  <rect x="18" y="6" width="20" height="6" rx="2" fill="#FAF6EE" opacity="0.25"/>
  <g stroke="#FAF6EE" stroke-width="2.5" stroke-linecap="round" opacity="0.6">
    <line x1="14" y1="28" x2="42" y2="28"/>
    <line x1="14" y1="36" x2="42" y2="36"/>
    <line x1="14" y1="44" x2="34" y2="44"/>
  </g>
  <text x="28" y="22" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="13" fill="#FAF6EE">Dg</text>
</svg>`;
}

// Logo : logo uploadé de l'établissement si présent, sinon le mark générique.
// Taille de base 96px (agrandie), mise à l'échelle par `logo_echelle` (% ; défaut 100).
function logoHtml(data: BulletinBaseData): string {
  const facteur = (data.logo_echelle ?? 100) / 100;
  const px = Math.round(96 * facteur);
  return data.etablissement_logo_url
    ? `<img src="${escapeHtml(data.etablissement_logo_url)}" alt="" style="width:${px}px;height:${px}px;object-fit:contain;flex-shrink:0"/>`
    : logoMarkSvg(px);
}

// Bloc de texte d'en-tête configurable : échappé, sauts de ligne → <br>.
function formatEntete(txt: string): string {
  return escapeHtml(txt).replace(/\r?\n/g, '<br>');
}

// En-tête : texte officiel FR (bord gauche), logo (centre), texte officiel AR
// (bord droit, RTL) — selon la filière. La date est rendue en bas (cf. footer).
function headerHtml(data: BulletinBaseData, filiere: 'FR' | 'AR' | 'COMBINE'): string {
  const showFr = filiere !== 'AR';
  const showAr = filiere !== 'FR';
  // Placeholders vides toujours présents → le logo reste centré même si un seul bloc.
  const frBlock = `<div class="entete-text entete-fr">${showFr && data.entete_bulletin_fr ? formatEntete(data.entete_bulletin_fr) : ''}</div>`;
  const arBlock = `<div class="entete-text entete-ar" dir="rtl">${showAr && data.entete_bulletin_ar ? formatEntete(data.entete_bulletin_ar) : ''}</div>`;
  return `
  <div class="header-top">
    ${frBlock}
    <div class="header-logo">${logoHtml(data)}</div>
    ${arBlock}
  </div>
  <div class="school-name-line">${escapeHtml(data.etablissement_nom_fr)}</div>
  <hr class="divider"/>`;
}

// L'année scolaire n'est PAS répétée ici : elle figure dans l'encadré identité
// de l'élève (studentInfoHtml).
function titleHtml(periode: string): string {
  return `
  <div class="doc-title-wrap">
    <div class="doc-title-main">Tableau récapitulatif des notes &mdash; ${periode}</div>
  </div>`;
}

function titleAnnuelHtml(nbPeriodes = 3): string {
  // Libellé adapté au découpage de l'établissement (2 = semestres, 6 = bimestres…).
  const motPeriode = nbPeriodes === 2 ? 'semestres' : nbPeriodes === 6 ? 'bimestres' : 'trimestres';
  return `
  <div class="doc-title-wrap">
    <div class="doc-title-main">Bulletin annuel &mdash; ${nbPeriodes} ${motPeriode}</div>
  </div>`;
}

// Bandeau de contact de l'école, rendu juste après le titre : autorisation
// d'enseigner, téléphone, email (seuls les champs renseignés sont affichés).
function schoolBandHtml(data: BulletinBaseData): string {
  const parts: string[] = [];
  if (data.etablissement_autorisation) parts.push(`<span><b>Autorisation :</b> ${escapeHtml(data.etablissement_autorisation)}</span>`);
  if (data.etablissement_telephone)    parts.push(`<span><b>Tél :</b> ${escapeHtml(data.etablissement_telephone)}</span>`);
  if (data.etablissement_email)        parts.push(`<span><b>Email :</b> ${escapeHtml(data.etablissement_email)}</span>`);
  if (parts.length === 0) return '';
  return `<div class="school-band">${parts.join('')}</div>`;
}

function studentInfoHtml(data: BulletinBaseData): string {
  // Né(e) le <date> à <lieu> — le rang n'apparaît plus en haut (déplacé en bas
  // dans la ligne de résultats / le résumé).
  const naissance = data.eleve_date_naissance
    ? `${data.eleve_date_naissance}${data.eleve_lieu_naissance ? ` à ${data.eleve_lieu_naissance}` : ''}`
    : (data.eleve_lieu_naissance ?? '—');

  // Maître(s) de la classe : les deux (FR + AR) sur un bulletin combiné, sinon un seul.
  const siRow = (label: string, value: string) =>
    `<div class="si-row"><span class="si-label">${label}</span><span class="si-value">${escapeHtml(value)}</span></div>`;
  let maitresRows = '';
  if (data.maitre_fr && data.maitre_ar) {
    maitresRows = siRow('Enseignant(e) FR :', data.maitre_fr) + siRow('Enseignant(e) AR :', data.maitre_ar);
  } else if (data.maitre_fr || data.maitre_ar) {
    maitresRows = siRow('Enseignant(e) :', (data.maitre_fr || data.maitre_ar)!);
  }

  return `
  <div class="student-info">
    <div class="si-row">
      <span class="si-label">Prénom(s) &amp; Nom :</span>
      <span class="si-value">${escapeHtml(data.eleve_nom_fr)}</span>
    </div>
    <div class="si-row">
      <span class="si-label">Matricule :</span>
      <span class="si-value">${escapeHtml(data.eleve_matricule)}</span>
    </div>
    <div class="si-row">
      <span class="si-label">Né(e) le :</span>
      <span class="si-value">${escapeHtml(naissance)}</span>
    </div>
    <div class="si-row">
      <span class="si-label">Année scolaire :</span>
      <span class="si-value">${escapeHtml(data.annee_libelle)}</span>
    </div>
    ${maitresRows}
  </div>`;
}

function footerHtml(data: BulletinBaseData): string {
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const sig = (label: string) => `
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">${label}</div>
    </div>`;
  return `
  <div class="footer-date">le ${today}</div>
  <div class="footer">
    ${sig("L'enseignant(e) (FR)")}
    ${sig("L'enseignant(e) (AR)")}
    <div class="footer-brand">${escapeHtml(data.etablissement_nom_fr)}<span class="gold-dot"></span></div>
    ${sig('Le Directeur')}
    ${sig('Les Parents')}
  </div>`;
}

// ─── Tableau FR ─────────────────────────────────────────────────────────────

// Contexte d'un tableau trimestriel : lignes calculées (HTML brut) + totaux formatés.
// Le « décor » (en-tête de section, libellés de colonnes, ligne Résultats) est
// désormais dans le modèle éditable (cf. DEFAULT_BULLETIN_TEMPLATE).
function ctxTableauTrim(notes: NoteRow[], bilingue: boolean) {
  const evaluees = notes.filter(n => n.evaluee !== false && n.valeur !== null);
  const totalCoeff = evaluees.reduce((s, n) => s + n.coeff, 0);
  const totalPoints = evaluees.reduce((s, n) => s + (n.valeur! * n.coeff), 0);
  const moy = moyenneNorm(notes);

  const rows = notes.map(n => {
    const nmax = n.note_max ?? RENDER_BASE;
    if (n.evaluee === false) {
      return `
      <tr>
        <td style="font-weight:500;color:#6b7280">${matiereLabel(n.nom_fr, n.nom_ar, bilingue)}</td>
        <td class="center" style="color:#9ca3af">${n.coeff}</td>
        <td class="center" style="color:#9ca3af">—</td>
        <td class="center" style="font-size:10px;color:#9ca3af">/${nmax}</td>
        <td style="color:#6b7280;font-style:italic;font-size:10px">Non évaluée</td>
      </tr>`;
    }
    const isFail = n.valeur !== null && n.valeur < nmax / 2;
    const cls = n.valeur !== null ? apprClass(n.valeur, nmax) : '';
    return `
    <tr>
      <td style="font-weight:500">${matiereLabel(n.nom_fr, n.nom_ar, bilingue)}</td>
      <td class="center">${n.coeff}</td>
      <td class="center grade ${isFail ? 'fail' : 'pass'}">
        ${n.valeur !== null ? Number(n.valeur).toFixed(2) : '—'}
      </td>
      <td class="center" style="font-size:10px;color:#6b7280">/${nmax}</td>
      <td class="${cls}">${getApprNom(n.valeur, nmax)}</td>
    </tr>`;
  }).join('');

  return {
    bilingue,
    lignes: rows || '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:10px">Aucune note saisie</td></tr>',
    coef_total: totalCoeff > 0 ? Number(totalCoeff).toFixed(1) : '—',
    total: totalPoints > 0 ? Number(totalPoints).toFixed(2) : '—',
    moyenne: moy !== null ? Number(moy).toFixed(2) : '—',
  };
}

// ─── Tableau annuel ──────────────────────────────────────────────────────────

// Contexte d'un tableau annuel : lignes calculées (HTML brut) + libellés de périodes.
function ctxTableauAnnuel(matieres: TrimestreRow[], bilingue: boolean, nbPeriodes: number, nomsFr?: string[]) {
  const rows = matieres.map(m => {
    if (m.evaluee === false) {
      const cells = m.valeurs.map(() => '<td class="center" style="color:#9ca3af">—</td>').join('');
      return `
      <tr>
        <td style="font-weight:500;color:#6b7280">${matiereLabel(m.nom_fr, m.nom_ar, bilingue)}</td>
        <td class="center" style="color:#9ca3af">${m.coeff}</td>
        ${cells}
        <td class="center" style="color:#9ca3af;background:#f9fafb">—</td>
        <td style="color:#6b7280;font-style:italic;font-size:10px">Non évaluée</td>
      </tr>`;
    }
    return `
    <tr>
      <td style="font-weight:500">${matiereLabel(m.nom_fr, m.nom_ar, bilingue)}</td>
      <td class="center">${m.coeff}</td>
      ${m.valeurs.map(v => `<td class="center grade ${v !== null && v < (m.note_max ?? RENDER_BASE) / 2 ? 'fail' : 'pass'}">${v !== null ? Number(v).toFixed(2) : '—'}</td>`).join('')}
      <td class="center grade ${m.moyenne_annuelle !== null && m.moyenne_annuelle < (m.note_max ?? RENDER_BASE) / 2 ? 'fail' : 'pass'}" style="font-weight:700;background:#f0fdf4">
        ${m.moyenne_annuelle !== null ? Number(m.moyenne_annuelle).toFixed(2) : '—'}
      </td>
      <td class="${m.moyenne_annuelle !== null ? apprClass(m.moyenne_annuelle, m.note_max ?? RENDER_BASE) : ''}">
        ${getApprNom(m.moyenne_annuelle, m.note_max ?? RENDER_BASE)}
      </td>
    </tr>`;
  }).join('');
  return {
    bilingue,
    periodes: Array.from({ length: nbPeriodes }, (_, i) => ({ label: periodeNomFr(i + 1, nbPeriodes, nomsFr) })),
    lignes: rows,
  };
}

// ─── Résumé combiné ──────────────────────────────────────────────────────────

function getMention(moyenne: number | null): string {
  if (moyenne === null) return '—';
  return mentionForBilingue(moyenne) || '—';
}

// Les résumés (simple FR/AR et combiné) sont désormais décrits dans le modèle
// éditable (DEFAULT_BULLETIN_TEMPLATE) ; le contexte fournit les valeurs calculées
// (moyenne_generale, rang, mention, moy_fr, moy_ar…). Couleur du résumé :
function couleurMoyenne(m: number | null, seuil: number): string {
  return m !== null && m >= seuil ? '#059669' : '#dc2626';
}

// Récapitulatif des absences (cumul année), justifiées / non justifiées, bilingue.
// Masqué si le réglage `afficher_absences` est désactivé.
function absencesHtml(data: BulletinBaseData): string {
  if (data.afficher_absences === false) return '';
  const j = data.absences_justifiees ?? 0;
  const nj = data.absences_non_justifiees ?? 0;
  const total = j + nj;
  return `
  <table class="combined-summary" style="margin-top:8px">
    <thead>
      <tr>
        <th>Total absences<br><span class="th-ar">مجموع الغيابات</span></th>
        <th>Justifiées<br><span class="th-ar">مبررة</span></th>
        <th>Non justifiées<br><span class="th-ar">غير مبررة</span></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="font-weight:700">${total}</td>
        <td>${j}</td>
        <td style="${nj > 0 ? 'color:#dc2626;font-weight:700' : ''}">${nj}</td>
      </tr>
    </tbody>
  </table>`;
}

function observationHtml(appr: string | null): string {
  const fr = appr ? escapeHtml(appr) : '';
  const ar = appr ? appreciationArFor(appr) : '';
  return `
  <div class="appreciation-box">
    <div class="appreciation-label" style="display:flex;justify-content:space-between;gap:10px;align-items:center"><span>Observation / Appréciation du conseil de classe</span><span dir="rtl" style="font-size:12px;color:#1f2937;text-transform:none">ملاحظات مجلس القسم</span></div>
    <div style="display:flex;justify-content:space-between;gap:10px;margin-top:3px;min-height:16px">
      <span style="font-size:11.5px;font-style:italic;color:#374151">${fr}</span>
      ${ar ? `<span dir="rtl" style="font-size:13px;color:#1f2937">${escapeHtml(ar)}</span>` : ''}
    </div>
    <div class="observation-line"></div>
  </div>`;
}

// ─── Modèle éditable (moteur micro-gabarit) ─────────────────────────────────

// Placeholders « bloc » (HTML calculé) insérables depuis l'éditeur, avec le token
// EXACT à insérer (triple accolade = HTML brut, non échappé).
export const BULLETIN_PLACEHOLDERS = [
  { token: '{{{en_tete}}}',       desc: 'En-tête (logo + textes officiels)' },
  { token: '{{{titre}}}',         desc: 'Titre du bulletin (période / annuel)' },
  { token: '{{{bandeau_ecole}}}', desc: 'Bandeau contact école' },
  { token: '{{{infos_eleve}}}',   desc: "Informations de l'élève" },
  { token: '{{{absences}}}',      desc: 'Tableau des absences' },
  { token: '{{{observation}}}',   desc: 'Observation / appréciation du conseil' },
  { token: '{{{pied_de_page}}}',  desc: 'Pied de page (signatures)' },
] as const;

// Fragments composables des modèles par défaut. Chaque tableau est explicite (FR ou
// AR), rendu via une section objet {{#tableau_xx}}…{{/tableau_xx}} présente seulement
// pour la/les filière(s) concernée(s). Le moteur remplit {{{lignes}}} et les valeurs.
const FRAG_CHROME_TOP = `{{{en_tete}}}
{{{titre}}}
{{{bandeau_ecole}}}
{{{infos_eleve}}}`;

const FRAG_CHROME_BOTTOM = `{{{absences}}}
{{{observation}}}
{{{pied_de_page}}}`;

const FRAG_TABLE_FR = `{{#tableau_fr}}
<div class="eval-section">
  <div class="eval-header">Évaluation des acquis — Filière Française</div>
  <table>
    <thead><tr>
      <th style="width:42%">Matières</th>
      <th class="center" style="width:8%">Coeff.</th>
      <th class="center" style="width:10%">Note</th>
      <th class="center" style="width:8%">/ Max</th>
      <th style="width:32%">Appréciation</th>
    </tr></thead>
    <tbody>
      {{{lignes}}}
      <tr class="results-row">
        <td>Résultats</td>
        <td class="center">Coef: {{coef_total}}</td>
        <td class="center" colspan="2">Total: {{total}}</td>
        <td class="center">Moyenne: {{moyenne}} / {{note_max_etab}}</td>
      </tr>
    </tbody>
  </table>
</div>
{{/tableau_fr}}`;

const FRAG_TABLE_AR = `{{#tableau_ar}}
<div class="eval-section">
  <div class="eval-header">Évaluation des acquis — Filière Arabe <span dir="rtl" style="font-weight:400">— تقييم أداء التلاميذ في القسم العربي</span></div>
  <table>
    <thead><tr>
      <th style="width:42%">Matières<br><span class="th-ar" dir="rtl">المجال</span></th>
      <th class="center" style="width:8%">Coeff.<br><span class="th-ar" dir="rtl">معامل</span></th>
      <th class="center" style="width:10%">Note<br><span class="th-ar" dir="rtl">الدرجات</span></th>
      <th class="center" style="width:8%">/ Max<br><span class="th-ar" dir="rtl">على</span></th>
      <th style="width:32%">Appréciation<br><span class="th-ar" dir="rtl">التقدير</span></th>
    </tr></thead>
    <tbody>
      {{{lignes}}}
      <tr class="results-row">
        <td>Résultats<br><span class="th-ar" dir="rtl">النتائج</span></td>
        <td class="center">Coef: {{coef_total}} <span class="th-ar" dir="rtl">معامل</span></td>
        <td class="center" colspan="2">Total: {{total}} <span class="th-ar" dir="rtl">المجموع</span></td>
        <td class="center">Moyenne: {{moyenne}} / {{note_max_etab}} <span class="th-ar" dir="rtl">التقدير</span></td>
      </tr>
    </tbody>
  </table>
</div>
{{/tableau_ar}}`;

// Filière anglaise : même mise en page que le FR (LTR, non bilingue), avec une
// glose anglaise sur les libellés — miroir de la glose arabe du tableau AR.
const FRAG_TABLE_EN = `{{#tableau_en}}
<div class="eval-section">
  <div class="eval-header">Évaluation des acquis — Filière Anglaise <span style="font-weight:400">— English Section</span></div>
  <table>
    <thead><tr>
      <th style="width:42%">Matières <span style="font-weight:400;color:#6b7280">/ Subjects</span></th>
      <th class="center" style="width:8%">Coeff.</th>
      <th class="center" style="width:10%">Note <span style="font-weight:400;color:#6b7280">/ Mark</span></th>
      <th class="center" style="width:8%">/ Max</th>
      <th style="width:32%">Appréciation <span style="font-weight:400;color:#6b7280">/ Remark</span></th>
    </tr></thead>
    <tbody>
      {{{lignes}}}
      <tr class="results-row">
        <td>Résultats <span class="th-ar">/ Results</span></td>
        <td class="center">Coef: {{coef_total}}</td>
        <td class="center" colspan="2">Total: {{total}}</td>
        <td class="center">Moyenne: {{moyenne}} / {{note_max_etab}} <span class="th-ar">/ Average</span></td>
      </tr>
    </tbody>
  </table>
</div>
{{/tableau_en}}`;

const FRAG_TABLE_ANNUEL_FR = `{{#tableau_annuel_fr}}
<div class="eval-section">
  <div class="eval-header">Évaluation annuelle — Filière Française</div>
  <table>
    <thead><tr>
      <th style="width:35%">Matière</th>
      <th class="center" style="width:7%">Coeff.</th>
      {{#periodes}}<th class="center">{{label}}</th>{{/periodes}}
      <th class="center" style="background:#f0fdf4;color:#059669">Moy. Ann.</th>
      <th style="width:22%">Appréciation</th>
    </tr></thead>
    <tbody>{{{lignes}}}</tbody>
  </table>
</div>
{{/tableau_annuel_fr}}`;

const FRAG_TABLE_ANNUEL_AR = `{{#tableau_annuel_ar}}
<div class="eval-section">
  <div class="eval-header">Évaluation annuelle — Filière Arabe <span dir="rtl" style="font-weight:400">— تقييم أداء التلاميذ في القسم العربي</span></div>
  <table>
    <thead><tr>
      <th style="width:35%">Matière<br><span class="th-ar" dir="rtl">المجال</span></th>
      <th class="center" style="width:7%">Coeff.<br><span class="th-ar" dir="rtl">معامل</span></th>
      {{#periodes}}<th class="center">{{label}}</th>{{/periodes}}
      <th class="center" style="background:#f0fdf4;color:#059669">Moy. Ann.</th>
      <th style="width:22%">Appréciation<br><span class="th-ar" dir="rtl">التقدير</span></th>
    </tr></thead>
    <tbody>{{{lignes}}}</tbody>
  </table>
</div>
{{/tableau_annuel_ar}}`;

const FRAG_TABLE_ANNUEL_EN = `{{#tableau_annuel_en}}
<div class="eval-section">
  <div class="eval-header">Évaluation annuelle — Filière Anglaise <span style="font-weight:400">— English Section</span></div>
  <table>
    <thead><tr>
      <th style="width:35%">Matière <span style="font-weight:400;color:#6b7280">/ Subject</span></th>
      <th class="center" style="width:7%">Coeff.</th>
      {{#periodes}}<th class="center">{{label}}</th>{{/periodes}}
      <th class="center" style="background:#f0fdf4;color:#059669">Moy. Ann.</th>
      <th style="width:22%">Appréciation <span style="font-weight:400;color:#6b7280">/ Remark</span></th>
    </tr></thead>
    <tbody>{{{lignes}}}</tbody>
  </table>
</div>
{{/tableau_annuel_en}}`;

const FRAG_RESUME_SIMPLE = `<table class="combined-summary">
  <thead><tr>
    <th>Moyenne Générale<br><span class="th-ar">المعدل العام</span></th>
    {{#afficher_rang}}<th>Rang<br><span class="th-ar">الترتيب</span></th>{{/afficher_rang}}
    <th>Mention<br><span class="th-ar">التقدير</span></th>
  </tr></thead>
  <tbody><tr>
    <td style="font-weight:700;font-size:13px;color:{{moy_color}}">{{moyenne_generale}}</td>
    {{#afficher_rang}}<td>{{rang}}</td>{{/afficher_rang}}
    <td class="mention-cell" style="color:{{moy_color}}">{{{mention}}}</td>
  </tr></tbody>
</table>`;

const FRAG_RESUME_COMBINE = `<table class="combined-summary">
  <thead><tr>
    <th>Résultats FR — AR</th>
    <th>Moy. FR<br><span class="th-ar">معدل الفرنسية</span></th>
    <th>Moy. AR<br><span class="th-ar">معدل المواد العربية</span></th>
    <th>Moyenne Générale<br><span class="th-ar">المعدل العام</span></th>
    {{#afficher_rang}}<th>Rang<br><span class="th-ar">الترتيب</span></th>{{/afficher_rang}}
    <th>Mention<br><span class="th-ar">التقدير</span></th>
  </tr></thead>
  <tbody><tr>
    <td style="font-weight:600">{{annee}}</td>
    <td>{{moy_fr}}</td>
    <td>{{moy_ar}}</td>
    <td style="font-weight:700;font-size:13px;color:{{moy_color}}">{{moyenne_generale}}</td>
    {{#afficher_rang}}<td>{{rang}}</td>{{/afficher_rang}}
    <td class="mention-cell" style="color:{{moy_color}}">{{{mention}}}</td>
  </tr></tbody>
</table>`;

// Résumé combiné GÉNÉRIQUE (N filières) : une sous-moyenne par filière via
// {{#sous_moyennes}}. Utilisé pour tout combiné qui n'est PAS exactement FR+AR
// (celui-ci garde FRAG_RESUME_COMBINE, inchangé au pixel près).
const FRAG_RESUME_COMBINE_N = `<table class="combined-summary">
  <thead><tr>
    <th>Résultats</th>
    {{#sous_moyennes}}<th>{{label}}</th>{{/sous_moyennes}}
    <th>Moyenne Générale<br><span class="th-ar">المعدل العام</span></th>
    {{#afficher_rang}}<th>Rang<br><span class="th-ar">الترتيب</span></th>{{/afficher_rang}}
    <th>Mention<br><span class="th-ar">التقدير</span></th>
  </tr></thead>
  <tbody><tr>
    <td style="font-weight:600">{{annee}}</td>
    {{#sous_moyennes}}<td>{{valeur}}</td>{{/sous_moyennes}}
    <td style="font-weight:700;font-size:13px;color:{{moy_color}}">{{moyenne_generale}}</td>
    {{#afficher_rang}}<td>{{rang}}</td>{{/afficher_rang}}
    <td class="mention-cell" style="color:{{moy_color}}">{{{mention}}}</td>
  </tr></tbody>
</table>`;

// Fragment de tableau par code de filière (trimestriel / annuel).
const FRAG_TABLE_BY_CODE: Record<string, string> = { FR: FRAG_TABLE_FR, AR: FRAG_TABLE_AR, EN: FRAG_TABLE_EN };
const FRAG_TABLE_ANNUEL_BY_CODE: Record<string, string> = { FR: FRAG_TABLE_ANNUEL_FR, AR: FRAG_TABLE_ANNUEL_AR, EN: FRAG_TABLE_ANNUEL_EN };

// Assemble le modèle par défaut d'un bulletin COMBINÉ pour un ensemble de filières.
// FR+AR exactement → résumé historique (Moy. FR / Moy. AR) ; sinon résumé générique.
function buildCombineTemplate(codes: string[], annuel = false): string {
  const map = annuel ? FRAG_TABLE_ANNUEL_BY_CODE : FRAG_TABLE_BY_CODE;
  const tables = codes.map(c => map[c]).filter(Boolean).join('\n');
  const isClassicFrAr = codes.length === 2 && codes[0] === 'FR' && codes[1] === 'AR';
  const resume = isClassicFrAr ? FRAG_RESUME_COMBINE : FRAG_RESUME_COMBINE_N;
  return `${FRAG_CHROME_TOP}\n${tables}\n${resume}\n${FRAG_CHROME_BOTTOM}`;
}

// Libellé court de sous-moyenne par filière (résumé combiné).
const SOUS_MOY_LABEL: Record<string, string> = { FR: 'Moy. FR', AR: 'Moy. AR', EN: 'Moy. EN' };

export type TypeModeleBulletin = 'FR' | 'AR' | 'EN' | 'COMBINE' | 'ANNUEL';
export const BULLETIN_TYPES: TypeModeleBulletin[] = ['FR', 'AR', 'EN', 'COMBINE', 'ANNUEL'];
export const BULLETIN_TYPE_LABELS: Record<TypeModeleBulletin, string> = {
  FR: 'Bulletin français', AR: 'Bulletin arabe', EN: 'Bulletin anglais', COMBINE: 'Bulletin combiné (FR + AR)', ANNUEL: 'Bulletin annuel',
};

// UN modèle par défaut par type. HTML complet et éditable (en-têtes, libellés, titres…).
// Le moteur ne remplit que les lignes ({{{lignes}}}) et valeurs ({{moyenne}}, {{rang}}…).
export const DEFAULT_BULLETIN_TEMPLATES: Record<TypeModeleBulletin, string> = {
  FR:      `${FRAG_CHROME_TOP}\n${FRAG_TABLE_FR}\n${FRAG_RESUME_SIMPLE}\n${FRAG_CHROME_BOTTOM}`,
  AR:      `${FRAG_CHROME_TOP}\n${FRAG_TABLE_AR}\n${FRAG_RESUME_SIMPLE}\n${FRAG_CHROME_BOTTOM}`,
  EN:      `${FRAG_CHROME_TOP}\n${FRAG_TABLE_EN}\n${FRAG_RESUME_SIMPLE}\n${FRAG_CHROME_BOTTOM}`,
  // FR+AR : modèle historique (via buildCombineTemplate → résumé Moy. FR / Moy. AR).
  COMBINE: buildCombineTemplate(['FR', 'AR'], false),
  // La section {{#tableau_annuel_en}} n'apparaît que si des matières EN sont fournies
  // (undefined pour FR/AR/COMBINE) → aucune régression sur les annuels existants.
  ANNUEL:  `${FRAG_CHROME_TOP}\n${FRAG_TABLE_ANNUEL_FR}\n${FRAG_TABLE_ANNUEL_AR}\n${FRAG_TABLE_ANNUEL_EN}\n{{#est_combine}}${FRAG_RESUME_COMBINE}{{/est_combine}}{{^est_combine}}${FRAG_RESUME_SIMPLE}{{/est_combine}}\n${FRAG_CHROME_BOTTOM}`,
};

// Blocs « décor » calculés (HTML brut) communs à toutes les variantes.
function chromeCtx(data: BulletinBaseData, filiere: 'FR' | 'AR' | 'COMBINE', titre: string): Record<string, unknown> {
  return {
    en_tete: headerHtml(data, filiere),
    titre,
    bandeau_ecole: schoolBandHtml(data),
    infos_eleve: studentInfoHtml(data),
    absences: absencesHtml(data),
    observation: observationHtml(data.appreciation),
    pied_de_page: footerHtml(data),
    note_max_etab: RENDER_BASE,
    afficher_rang: data.afficher_rang !== false,
  };
}

// Valeurs du résumé (moyenne générale, rang, mention, sous-moyennes) partagées
// par les variantes simple et combinée.
function resumeCtx(data: BulletinBaseData, estCombine: boolean, frMoy: number | null, arMoy: number | null): Record<string, unknown> {
  // Moyenne stockée = base canonique établissement → re-scale à l'échelle d'affichage
  // (RENDER_FACTOR = 1 pour le combiné et pour une filière à l'échelle établissement).
  const m = data.moyenne !== null ? Number(data.moyenne) * RENDER_FACTOR : null;
  return {
    est_combine: estCombine,
    annee: data.annee_libelle,
    moy_fr: frMoy !== null ? Number(frMoy).toFixed(2) : '—',
    moy_ar: arMoy !== null ? Number(arMoy).toFixed(2) : '—',
    moyenne_generale: m !== null ? `${Number(m).toFixed(2)} / ${RENDER_BASE}` : '—',
    moy_color: couleurMoyenne(m, estCombine ? 10 : RENDER_BASE / 2),
    rang: data.rang ?? '—',
    mention: getMention(m),
  };
}

// Assemble le document final : modèle personnalisé du type (si présent) sinon défaut.
function renderBulletinDoc(customTpl: string | null | undefined, defaultTpl: string, ctx: Record<string, unknown>): string {
  const template = customTpl && customTpl.trim() ? customTpl : defaultTpl;
  const body = renderMicroTemplate(template, ctx);
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><style>${CSS}</style></head><body>${body}</body></html>`;
}

// ─── Exports principaux ─────────────────────────────────────────────────────

export function generateBulletinHtml(data: BulletinTrimestreData): string {
  setRenderContext(data);
  const nbP = data.nb_periodes ?? 3;
  const periodeStr = periodeNomFr(data.periode, nbP, data.noms_periodes?.fr);
  const notesFR = data.notes_fr ?? [];
  const notesAR = data.notes_ar ?? [];
  const notesEN = data.notes_en ?? [];

  // En-tête : la filière anglaise (LTR) réutilise le bloc officiel FR (showFr) —
  // il n'y a pas de troisième bloc d'en-tête. `headerHtml` reste FR/AR/COMBINE.
  let filiere: 'FR' | 'AR' | 'COMBINE';
  let titre: string;
  let estCombine = false;
  let frMoy: number | null = null;
  let arMoy: number | null = null;
  let tableau_fr: ReturnType<typeof ctxTableauTrim> | undefined;
  let tableau_ar: ReturnType<typeof ctxTableauTrim> | undefined;
  let tableau_en: ReturnType<typeof ctxTableauTrim> | undefined;
  let sousMoyennes: { code: string; label: string; valeur: string }[] | undefined;
  let defaultTpl = DEFAULT_BULLETIN_TEMPLATES[data.type];

  if (data.type === 'FR') {
    filiere = 'FR';
    titre = titleHtml(periodeStr);
    tableau_fr = ctxTableauTrim(notesFR, false);
  } else if (data.type === 'AR') {
    filiere = 'AR';
    // Titre bilingue (FR + AR), cohérent avec les libellés arabes du tableau AR.
    titre = titleHtml(`${periodeStr} — <span dir="rtl">${periodeNomAr(data.periode)}</span>`);
    tableau_ar = ctxTableauTrim(notesAR, true);
  } else if (data.type === 'EN') {
    filiere = 'FR';
    titre = titleHtml(`${periodeStr} — English report`);
    tableau_en = ctxTableauTrim(notesEN, false);
  } else {
    // COMBINE = fusion des filières actives (défaut ['FR','AR'] → inchangé).
    filiere = 'COMBINE';
    estCombine = true;
    const codes = data.filieres_combine?.length ? data.filieres_combine : ['FR', 'AR'];
    const notesByCode: Record<string, NoteRow[]> = { FR: notesFR, AR: notesAR, EN: notesEN };
    if (codes.includes('FR')) tableau_fr = ctxTableauTrim(notesFR, false);
    if (codes.includes('AR')) tableau_ar = ctxTableauTrim(notesAR, true);
    if (codes.includes('EN')) tableau_en = ctxTableauTrim(notesEN, false);
    frMoy = moyenneNorm(notesFR);
    arMoy = moyenneNorm(notesAR);
    sousMoyennes = codes.map(c => {
      const m = moyenneNorm(notesByCode[c] ?? []);
      return { code: c, label: SOUS_MOY_LABEL[c] ?? `Moy. ${c}`, valeur: m !== null ? Number(m).toFixed(2) : '—' };
    });
    // Terme arabe du trimestre seulement si la filière AR fait partie du combiné.
    const termeAr = codes.includes('AR') ? ` — <span dir="rtl">${periodeNomAr(data.periode)}</span>` : '';
    titre = titleHtml(`${periodeStr}${termeAr} · Filières ${codes.join(' &amp; ')}`);
    defaultTpl = buildCombineTemplate(codes, false);
  }

  return renderBulletinDoc(data.template_html, defaultTpl, {
    ...chromeCtx(data, filiere, titre),
    ...resumeCtx(data, estCombine, frMoy, arMoy),
    tableau_fr,
    tableau_ar,
    tableau_en,
    sous_moyennes: sousMoyennes,
  });
}

export function generateBulletinAnnuelHtml(data: BulletinAnnuelData): string {
  setRenderContext(data);
  const isCombine = data.type === 'ANNUEL_COMBINE';
  const isAR = data.type === 'ANNUEL_AR';
  const isEN = data.type === 'ANNUEL_EN';
  const nbPeriodes = data.nb_periodes ?? 3;

  const mFR = data.matieres_fr ?? [];
  const mAR = data.matieres_ar ?? [];
  const mEN = data.matieres_en ?? [];

  // Sous-moyenne annuelle d'une filière (matières non évaluées exclues).
  const moyOf = (mats: TrimestreRow[]): number | null => {
    const withMoy = mats.filter(m => m.evaluee !== false && m.moyenne_annuelle !== null);
    const coeff = withMoy.reduce((s, m) => s + m.coeff, 0);
    return coeff > 0 ? withMoy.reduce((s, m) => s + m.moyenne_annuelle! * m.coeff, 0) / coeff : null;
  };
  const frMoy = moyOf(mFR);
  const arMoy = moyOf(mAR);

  // COMBINE = fusion des filières actives (défaut ['FR','AR']) ; simple = filière unique.
  const codes = isCombine ? (data.filieres_combine?.length ? data.filieres_combine : ['FR', 'AR']) : [];

  const tableau_annuel_fr = (((isCombine && codes.includes('FR')) || (!isCombine && !isAR && !isEN)) && mFR.length > 0) ? ctxTableauAnnuel(mFR, false, nbPeriodes, data.noms_periodes?.fr) : undefined;
  const tableau_annuel_ar = (((isCombine && codes.includes('AR')) || (!isCombine && isAR)) && mAR.length > 0) ? ctxTableauAnnuel(mAR, true, nbPeriodes, data.noms_periodes?.fr) : undefined;
  const tableau_annuel_en = (((isCombine && codes.includes('EN')) || (!isCombine && isEN)) && mEN.length > 0) ? ctxTableauAnnuel(mEN, false, nbPeriodes, data.noms_periodes?.fr) : undefined;

  const moyByCode: Record<string, number | null> = { FR: frMoy, AR: arMoy, EN: moyOf(mEN) };
  const sousMoyennes = isCombine
    ? codes.map(c => ({ code: c, label: SOUS_MOY_LABEL[c] ?? `Moy. ${c}`, valeur: moyByCode[c] !== null ? Number(moyByCode[c]).toFixed(2) : '—' }))
    : undefined;

  // EN (LTR) réutilise le bloc d'en-tête FR ; combiné → en-tête FR+AR.
  const filiere = isAR ? 'AR' : isCombine ? 'COMBINE' : 'FR';
  // Combiné : modèle assemblé pour les filières présentes (FR+AR = historique).
  const defaultTpl = isCombine ? buildCombineTemplate(codes, true) : DEFAULT_BULLETIN_TEMPLATES.ANNUEL;
  return renderBulletinDoc(data.template_html, defaultTpl, {
    ...chromeCtx(data, filiere, titleAnnuelHtml(nbPeriodes)),
    ...resumeCtx(data, isCombine, frMoy, arMoy),
    tableau_annuel_fr,
    tableau_annuel_ar,
    tableau_annuel_en,
    sous_moyennes: sousMoyennes,
  });
}
