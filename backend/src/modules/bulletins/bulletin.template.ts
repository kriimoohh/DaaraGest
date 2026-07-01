import { escapeHtml } from '../../utils/escapeHtml';
import { DEFAULT_NOTE_MAX } from '../../utils/notes';

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

// Échelle de l'établissement (ex: 10) + mentions configurées, fixées au début du rendu.
type MentionRow = { libelle_fr: string; libelle_ar?: string | null; seuil_min: number };
let RENDER_BASE = DEFAULT_NOTE_MAX;
let RENDER_MENTIONS: MentionRow[] = [];
function setRenderContext(d: { note_max_etab?: number; mentions?: MentionRow[] }) {
  RENDER_BASE = d.note_max_etab ?? DEFAULT_NOTE_MAX;
  RENDER_MENTIONS = (d.mentions ?? []).slice().sort((a, b) => b.seuil_min - a.seuil_min);
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
  type: 'FR' | 'AR' | 'COMBINE';
  periode: number;
  notes_fr?: NoteRow[];
  notes_ar?: NoteRow[];
}

export interface BulletinAnnuelData extends BulletinBaseData {
  type: 'ANNUEL_FR' | 'ANNUEL_AR' | 'ANNUEL_COMBINE';
  matieres_fr?: TrimestreRow[];
  matieres_ar?: TrimestreRow[];
}

// ─── Constantes ─────────────────────────────────────────────────────────────

const periodeLabel = (p: number) =>
  ({ 1: '1er Trimestre', 2: '2ème Trimestre', 3: '3ème Trimestre' }[p] ?? `Période ${p}`);

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
.header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px }
.header-top { display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:6px }
.entete-text { font-size:10.5px;color:#374151;line-height:1.45;flex:1 }
.entete-fr { text-align:left }
/* Arabe : couleur sombre pour la visibilité, mais graisse NORMALE (le gras
   casse le rendu/chaînage des glyphes arabes) et taille mesurée (pas « grosse »).
   La lisibilité vient surtout de la police Noto Naskh Arabic (cf. @import). */
.entete-ar { text-align:right;direction:rtl;font-size:11.5px;color:#1f2937;line-height:1.7 }
.header-logo { flex-shrink:0;align-self:center }
.school-name-line { text-align:center;font-size:15px;font-weight:bold;color:#0F172A;text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px }
.school-block { flex:1 }
.school-name { font-size:15px;font-weight:bold;color:#0F172A;text-transform:uppercase;letter-spacing:.3px }
.school-name-ar { font-size:13px;color:#374151;direction:rtl;margin-top:2px }
.header-date { font-size:11px;color:#374151;white-space:nowrap;padding-top:2px }
.divider { border:none;border-top:2.5px solid #B85433;margin:8px 0 12px }

/* ── Titre principal ── */
.doc-title-wrap { border:2px solid #0F172A;border-radius:4px;margin-bottom:12px;overflow:hidden }
.doc-title-main { background:#0F172A;color:#fff;text-align:center;padding:6px 10px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.4px }

/* ── Bandeau contact école ── */
.school-band { display:flex;justify-content:center;flex-wrap:wrap;gap:4px 18px;font-size:10px;color:#374151;margin-bottom:10px;padding:5px 8px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px }
.school-band b { color:#0F172A;font-weight:700 }

/* ── Infos élève ── */
.student-info { display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin-bottom:12px;border:1px solid #d1d5db;border-radius:6px;padding:10px 14px }
.si-row { display:flex;gap:6px;align-items:baseline }
.si-label { font-weight:700;font-size:11px;white-space:nowrap }
.si-value { font-size:12px;border-bottom:1px dotted #9ca3af;flex:1;min-width:80px }

/* ── Tableau d'évaluation ── */
.eval-section { margin-bottom:14px }
.eval-header { background:#0F172A;color:#fff;text-align:center;padding:5px 8px;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;border-radius:4px 4px 0 0 }
table { width:100%;border-collapse:collapse }
thead { background:#f0fdf4 }
th { padding:6px 8px;text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#374151;border-bottom:2px solid #10B981;border-right:1px solid #d1d5db }
th:last-child { border-right:none }
td { padding:5px 8px;border-bottom:1px solid #e5e7eb;border-right:1px solid #f3f4f6;font-size:12px }
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
.combined-summary { width:100%;border-collapse:collapse;margin-top:12px;border:1.5px solid #0F172A;border-radius:4px;overflow:hidden }
.combined-summary th { background:#0F172A;color:#fff;padding:5px 6px;font-size:10.5px;text-align:center;border-right:1px solid #374151;text-transform:uppercase }
.combined-summary td { padding:5px 6px;text-align:center;font-size:12px;border-right:1px solid #d1d5db;border-top:1px solid #d1d5db }
.combined-summary td:last-child, .combined-summary th:last-child { border-right:none }
.mention-cell { font-weight:700;font-size:13px }
.th-ar { font-weight:400;font-size:10px;opacity:1 }

/* ── Boîte appréciation ── */
.appreciation-box { border:1px solid #e5e7eb;border-radius:6px;padding:8px 12px;background:#fafafa;margin:10px 0 }
.appreciation-label { font-size:9.5px;color:#6b7280;text-transform:uppercase;margin-bottom:3px }
.observation-line { border-bottom:1px solid #d1d5db;min-height:18px;margin-top:8px }

/* ── Pied de page ── */
.footer-date { text-align:right;font-size:10.5px;color:#374151;margin-top:14px }
.footer { display:flex;justify-content:space-between;margin-top:8px;padding-top:10px;border-top:1.5px solid #e5e7eb }
.signature-box { text-align:center;min-width:110px }
.signature-line { width:110px;border-bottom:1px solid #374151;margin:26px auto 4px }
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

function tableFR(notes: NoteRow[], headerTitle = 'Évaluation des acquis — Filière Française', bilingue = false): string {
  // Matières évaluées uniquement → contribuent aux totaux et à la moyenne.
  const evalueesAvecNote = notes.filter(n => n.evaluee !== false && n.valeur !== null);
  const totalCoeff = evalueesAvecNote.reduce((s, n) => s + n.coeff, 0);
  const totalPoints = evalueesAvecNote.reduce((s, n) => s + (n.valeur! * n.coeff), 0);
  const moy = moyenneNorm(notes);

  const rows = notes.map(n => {
    const nmax = n.note_max ?? RENDER_BASE;
    const nonEvaluee = n.evaluee === false;
    if (nonEvaluee) {
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
    const appr = getApprNom(n.valeur, nmax);
    const cls = n.valeur !== null ? apprClass(n.valeur, nmax) : '';
    return `
    <tr>
      <td style="font-weight:500">${matiereLabel(n.nom_fr, n.nom_ar, bilingue)}</td>
      <td class="center">${n.coeff}</td>
      <td class="center grade ${isFail ? 'fail' : 'pass'}">
        ${n.valeur !== null ? Number(n.valeur).toFixed(2) : '—'}
      </td>
      <td class="center" style="font-size:10px;color:#6b7280">/${nmax}</td>
      <td class="${cls}">${appr}</td>
    </tr>`;
  }).join('');

  const moyStr = moy !== null ? Number(moy).toFixed(2) : '—';
  const ptStr  = totalPoints > 0 ? Number(totalPoints).toFixed(2) : '—';
  const cfStr  = totalCoeff > 0 ? Number(totalCoeff).toFixed(1) : '—';

  return `
  <div class="eval-section">
    <div class="eval-header">${headerTitle}</div>
    <table>
      <thead><tr>
        <th style="width:42%">Matières</th>
        <th class="center" style="width:8%">Coeff.</th>
        <th class="center" style="width:10%">Note</th>
        <th class="center" style="width:8%">/ Max</th>
        <th style="width:32%">Appréciation</th>
      </tr></thead>
      <tbody>
        ${rows || '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:10px">Aucune note saisie</td></tr>'}
        <tr class="results-row">
          <td>Résultats</td>
          <td class="center">Coef: ${cfStr}</td>
          <td class="center" colspan="2">Total: ${ptStr}</td>
          <td class="center">Moyenne: ${moyStr} / ${RENDER_BASE}</td>
        </tr>
      </tbody>
    </table>
  </div>`;
}

// ─── Tableau annuel ──────────────────────────────────────────────────────────

function tableAnnuelFR(matieres: TrimestreRow[], headerTitle = 'Évaluation annuelle — Filière Française', bilingue = false): string {
  const rows = matieres.map(m => {
    const nonEvaluee = m.evaluee === false;
    if (nonEvaluee) {
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
  return `
  <div class="eval-section">
    <div class="eval-header">${headerTitle}</div>
    <table>
      <thead><tr>
        <th style="width:35%">Matière</th>
        <th class="center" style="width:7%">Coeff.</th>
        <th class="center">T1</th>
        <th class="center">T2</th>
        <th class="center">T3</th>
        <th class="center" style="background:#f0fdf4;color:#059669">Moy. Ann.</th>
        <th style="width:22%">Appréciation</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ─── Résumé combiné ──────────────────────────────────────────────────────────

function getMention(moyenne: number | null): string {
  if (moyenne === null) return '—';
  return mentionForBilingue(moyenne) || '—';
}

// Ligne de résultats bas de page pour les bulletins simples (FR ou AR) — porte
// désormais le rang (retiré de l'en-tête), avec libellés bilingues FR/AR.
function resultsSummaryHtml(data: BulletinBaseData): string {
  const moy = data.moyenne;
  const mention = getMention(moy);
  const color = moy !== null && moy >= RENDER_BASE / 2 ? '#059669' : '#dc2626';
  const showRang = data.afficher_rang !== false;
  return `
  <table class="combined-summary">
    <thead>
      <tr>
        <th>Moyenne Générale<br><span class="th-ar">المعدل العام</span></th>
        ${showRang ? '<th>Rang<br><span class="th-ar">الرتبة</span></th>' : ''}
        <th>Mention<br><span class="th-ar">التقدير</span></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="font-weight:700;font-size:13px;color:${color}">${moy !== null ? `${Number(moy).toFixed(2)} / ${RENDER_BASE}` : '—'}</td>
        ${showRang ? `<td>${data.rang ?? '—'}</td>` : ''}
        <td class="mention-cell" style="color:${color}">${mention}</td>
      </tr>
    </tbody>
  </table>`;
}

function combinedSummaryHtml(data: BulletinBaseData, frMoy: number | null, arMoy: number | null): string {
  const globalMoy = data.moyenne;
  const mention = getMention(globalMoy);
  const mentionColor = globalMoy !== null && globalMoy >= 10 ? '#059669' : '#dc2626';
  const showRang = data.afficher_rang !== false;

  return `
  <table class="combined-summary">
    <thead>
      <tr>
        <th>Résultats FR — AR</th>
        <th>Moy. FR<br><span class="th-ar">معدل الفرنسية</span></th>
        <th>Moy. AR<br><span class="th-ar">معدل العربية</span></th>
        <th>Moyenne Générale<br><span class="th-ar">المعدل العام</span></th>
        ${showRang ? '<th>Rang<br><span class="th-ar">الرتبة</span></th>' : ''}
        <th>Mention<br><span class="th-ar">التقدير</span></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="font-weight:600">${escapeHtml(data.annee_libelle)}</td>
        <td>${frMoy !== null ? Number(frMoy).toFixed(2) : '—'}</td>
        <td>${arMoy !== null ? Number(arMoy).toFixed(2) : '—'}</td>
        <td style="font-weight:700;font-size:13px;color:${mentionColor}">${globalMoy !== null ? `${Number(globalMoy).toFixed(2)} / ${RENDER_BASE}` : '—'}</td>
        ${showRang ? `<td>${data.rang ?? '—'}</td>` : ''}
        <td class="mention-cell" style="color:${mentionColor}">${mention}</td>
      </tr>
    </tbody>
  </table>`;
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

// ─── Exports principaux ─────────────────────────────────────────────────────

export function generateBulletinHtml(data: BulletinTrimestreData): string {
  setRenderContext(data);
  const periodeStr = periodeLabel(data.periode);

  if (data.type === 'FR') {
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><style>${CSS}</style></head><body>
      ${headerHtml(data, 'FR')}
      ${titleHtml(periodeStr)}
      ${schoolBandHtml(data)}
    ${studentInfoHtml(data)}
      ${tableFR(data.notes_fr ?? [])}
      ${resultsSummaryHtml(data)}
      ${absencesHtml(data)}
      ${observationHtml(data.appreciation)}
      ${footerHtml(data)}
    </body></html>`;
  }

  if (data.type === 'AR') {
    // Filière arabe : noms de matières affichés en bilingue (FR + AR à côté).
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><style>${CSS}</style></head><body>
      ${headerHtml(data, 'AR')}
      ${titleHtml(periodeStr)}
      ${schoolBandHtml(data)}
    ${studentInfoHtml(data)}
      ${tableFR(data.notes_ar ?? [], 'Évaluation des acquis — Filière Arabe', true)}
      ${resultsSummaryHtml(data)}
      ${absencesHtml(data)}
      ${observationHtml(data.appreciation)}
      ${footerHtml(data)}
    </body></html>`;
  }

  // COMBINE — compute sub-moyennes
  const notesFR = data.notes_fr ?? [];
  const notesAR = data.notes_ar ?? [];
  const frMoy = moyenneNorm(notesFR);
  const arMoy = moyenneNorm(notesAR);

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><style>${CSS}</style></head><body>
    ${headerHtml(data, 'COMBINE')}
    ${titleHtml(`${periodeStr} — Filières FR &amp; AR`)}
    ${schoolBandHtml(data)}
    ${studentInfoHtml(data)}
    ${tableFR(notesFR)}
    ${tableFR(notesAR, 'Évaluation des acquis — Filière Arabe', true)}
    ${combinedSummaryHtml(data, frMoy, arMoy)}
    ${absencesHtml(data)}
    ${observationHtml(data.appreciation)}
    ${footerHtml(data)}
  </body></html>`;
}

export function generateBulletinAnnuelHtml(data: BulletinAnnuelData): string {
  setRenderContext(data);
  const isCombine = data.type === 'ANNUEL_COMBINE';
  const isAR = data.type === 'ANNUEL_AR';

  const mFR = data.matieres_fr ?? [];
  const mAR = data.matieres_ar ?? [];

  // Compute sub-moyennes for combined summary — matières non évaluées exclues.
  const frWithMoy = mFR.filter(m => m.evaluee !== false && m.moyenne_annuelle !== null);
  const arWithMoy = mAR.filter(m => m.evaluee !== false && m.moyenne_annuelle !== null);
  const frCoeff = frWithMoy.reduce((s, m) => s + m.coeff, 0);
  const arCoeff = arWithMoy.reduce((s, m) => s + m.coeff, 0);
  const frMoy = frCoeff > 0 ? frWithMoy.reduce((s, m) => s + m.moyenne_annuelle! * m.coeff, 0) / frCoeff : null;
  const arMoy = arCoeff > 0 ? arWithMoy.reduce((s, m) => s + m.moyenne_annuelle! * m.coeff, 0) / arCoeff : null;

  // Bulletins strictement en français, y compris la filière arabe (libellés FR, LTR).
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><style>${CSS}</style></head><body>
    ${headerHtml(data, isAR ? 'AR' : isCombine ? 'COMBINE' : 'FR')}
    ${titleAnnuelHtml(data.nb_periodes)}
    ${schoolBandHtml(data)}
    ${studentInfoHtml(data)}

    ${!isAR && mFR.length > 0 ? tableAnnuelFR(mFR) : ''}
    ${(isAR || isCombine) && mAR.length > 0 ? tableAnnuelFR(mAR, 'Évaluation annuelle — Filière Arabe', true) : ''}

    ${isCombine ? combinedSummaryHtml(data, frMoy, arMoy) : resultsSummaryHtml(data)}

    ${absencesHtml(data)}
    ${observationHtml(data.appreciation)}
    ${footerHtml(data)}
  </body></html>`;
}
