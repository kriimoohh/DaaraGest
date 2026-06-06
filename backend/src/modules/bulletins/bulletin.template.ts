import { escapeHtml } from '../../utils/escapeHtml';
import { DEFAULT_NOTE_MAX } from '../../utils/notes';

// ─── Types ──────────────────────────────────────────────────────────────────

interface NoteRow {
  nom_fr: string;
  nom_ar: string;
  coeff: number;
  valeur: number | null;
  note_max?: number;
}

interface TrimestreRow {
  nom_fr: string;
  nom_ar: string;
  coeff: number;
  note_max?: number;
  valeurs: (number | null)[];
  moyenne_annuelle: number | null;
}

interface BulletinBaseData {
  etablissement_nom_fr: string;
  eleve_nom_fr: string;
  eleve_matricule: string;
  annee_libelle: string;
  moyenne: number | null;
  rang: number | null;
  appreciation: string | null;
  devise: string;
  note_max_etab?: number;
  mentions?: { libelle_fr: string; seuil_min: number }[];
}

// Échelle de l'établissement (ex: 10) + mentions configurées, fixées au début du rendu.
let RENDER_BASE = DEFAULT_NOTE_MAX;
let RENDER_MENTIONS: { libelle_fr: string; seuil_min: number }[] = [];
function setRenderContext(d: { note_max_etab?: number; mentions?: { libelle_fr: string; seuil_min: number }[] }) {
  RENDER_BASE = d.note_max_etab ?? DEFAULT_NOTE_MAX;
  RENDER_MENTIONS = (d.mentions ?? []).slice().sort((a, b) => b.seuil_min - a.seuil_min);
}
// Mention pour une valeur ramenée sur l'échelle établissement (RENDER_BASE).
function mentionFor(scaled: number | null): string {
  if (scaled === null) return '';
  for (const m of RENDER_MENTIONS) if (scaled + 1e-9 >= m.seuil_min) return m.libelle_fr;
  return RENDER_MENTIONS.length ? RENDER_MENTIONS[RENDER_MENTIONS.length - 1].libelle_fr : '';
}
// Moyenne pondérée normalisée sur l'échelle établissement (notes saisies sur leur barème).
function moyenneNorm(notes: { valeur: number | null; coeff: number; note_max?: number }[]): number | null {
  const withVal = notes.filter(n => n.valeur !== null);
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

const periodeLabelAR = (p: number) =>
  ({ 1: 'الفصل الأول', 2: 'الفصل الثاني', 3: 'الفصل الثالث' }[p] ?? `الفصل ${p}`);

// Appréciation par matière = mentions configurées de l'établissement (mêmes bandes
// que la moyenne, ex /10 : Très bien≥10, Bien≥8…), appliquées à la note ramenée
// sur l'échelle établissement. Les relevés officiels affichent ces mentions en
// français même côté arabe → getApprNomAR délègue à getApprNom.
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

function getApprNomAR(note: number | null, noteMax: number): string {
  return getApprNom(note, noteMax);
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

const CSS = `
* { margin:0;padding:0;box-sizing:border-box }
body { font-family:Arial,sans-serif;font-size:11.5px;color:#111;padding:18px 28px }

/* ── En-tête ── */
.header { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px }
.school-block { flex:1 }
.school-name { font-size:15px;font-weight:bold;color:#0F172A;text-transform:uppercase;letter-spacing:.3px }
.school-name-ar { font-size:13px;color:#374151;direction:rtl;margin-top:2px }
.header-date { font-size:11px;color:#374151;white-space:nowrap;padding-top:2px }
.divider { border:none;border-top:2.5px solid #B85433;margin:8px 0 12px }

/* ── Titre principal ── */
.doc-title-wrap { border:2px solid #0F172A;border-radius:4px;margin-bottom:12px;overflow:hidden }
.doc-title-main { background:#0F172A;color:#fff;text-align:center;padding:6px 10px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.4px }
.doc-title-year { text-align:center;padding:4px;font-size:11px;color:#374151 }

/* ── Infos élève ── */
.student-info { display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin-bottom:12px;border:1px solid #d1d5db;border-radius:6px;padding:10px 14px }
.si-row { display:flex;gap:6px;align-items:baseline }
.si-label { font-weight:700;font-size:10.5px;white-space:nowrap }
.si-value { font-size:11.5px;border-bottom:1px dotted #9ca3af;flex:1;min-width:80px }

/* ── Tableau d'évaluation ── */
.eval-section { margin-bottom:14px }
.eval-header { background:#0F172A;color:#fff;text-align:center;padding:5px 8px;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;border-radius:4px 4px 0 0 }
.eval-header-ar { background:#10B981 }
table { width:100%;border-collapse:collapse }
thead { background:#f0fdf4 }
th { padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#374151;border-bottom:2px solid #10B981;border-right:1px solid #d1d5db }
th.ar-th { text-align:right;direction:rtl;background:#f0fff4;border-bottom-color:#10B981 }
th:last-child { border-right:none }
td { padding:5px 8px;border-bottom:1px solid #e5e7eb;border-right:1px solid #f3f4f6;font-size:11px }
td:last-child { border-right:none }
td.ar-td { text-align:right;direction:rtl }
tr:last-child td { border-bottom:none }
tr:nth-child(even) { background:#f9fafb }
.center { text-align:center }
.grade { font-weight:700;font-size:12px }
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
.results-row.results-ar td { background:#10B981 }

/* ── Section combinée ── */
.section-label { font-size:10.5px;font-weight:700;padding:4px 8px;margin-bottom:-1px;border-radius:4px 4px 0 0;display:inline-block }
.section-fr { background:#f0fdf4;color:#059669;border:1px solid #10B981 }
.section-ar { background:#ecfdf5;color:#065f46;border:1px solid #10B981;direction:rtl;float:right }

/* ── Résumé (combiné) ── */
.combined-summary { width:100%;border-collapse:collapse;margin-top:12px;border:1.5px solid #0F172A;border-radius:4px;overflow:hidden }
.combined-summary th { background:#0F172A;color:#fff;padding:5px 6px;font-size:9.5px;text-align:center;border-right:1px solid #374151;text-transform:uppercase }
.combined-summary td { padding:5px 6px;text-align:center;font-size:11px;border-right:1px solid #d1d5db;border-top:1px solid #d1d5db }
.combined-summary td:last-child, .combined-summary th:last-child { border-right:none }
.mention-cell { font-weight:700;font-size:12px }

/* ── Boîte appréciation ── */
.appreciation-box { border:1px solid #e5e7eb;border-radius:6px;padding:8px 12px;background:#fafafa;margin:10px 0 }
.appreciation-label { font-size:9.5px;color:#6b7280;text-transform:uppercase;margin-bottom:3px }
.observation-line { border-bottom:1px solid #d1d5db;min-height:18px;margin-top:8px }

/* ── Pied de page ── */
.footer { display:flex;justify-content:space-between;margin-top:20px;padding-top:10px;border-top:1.5px solid #e5e7eb }
.signature-box { text-align:center;min-width:110px }
.signature-line { width:110px;border-bottom:1px solid #374151;margin:26px auto 4px }
.signature-label { font-size:9.5px;color:#374151;font-weight:600 }
.footer-brand { text-align:center;font-size:9px;color:#9ca3af;align-self:flex-end;padding-bottom:2px }
.gold-dot { display:inline-block;width:6px;height:6px;border-radius:50%;background:#F59E0B;margin:0 3px }
`;

// ─── Header commun ─────────────────────────────────────────────────────────

const LOGO_MARK_SVG = `<svg width="56" height="64" viewBox="0 0 56 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
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

function headerHtml(data: BulletinBaseData): string {
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  return `
  <div class="header">
    <div class="school-block">
      <div style="display:flex;align-items:center;gap:10px">
        ${LOGO_MARK_SVG}
        <div>
          <div class="school-name">${escapeHtml(data.etablissement_nom_fr)}</div>
        </div>
      </div>
    </div>
    <div class="header-date">le ${today}</div>
  </div>
  <hr class="divider"/>`;
}

function titleHtml(periode: string, annee: string): string {
  return `
  <div class="doc-title-wrap">
    <div class="doc-title-main">Tableau récapitulatif des notes &mdash; ${periode}</div>
    <div class="doc-title-year">Année scolaire : <strong>${escapeHtml(annee)}</strong></div>
  </div>`;
}

function titleAnnuelHtml(annee: string): string {
  return `
  <div class="doc-title-wrap">
    <div class="doc-title-main">Bulletin annuel &mdash; 3 trimestres</div>
    <div class="doc-title-year">Année scolaire : <strong>${escapeHtml(annee)}</strong></div>
  </div>`;
}

function studentInfoHtml(data: BulletinBaseData): string {
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
      <span class="si-label">Rang :</span>
      <span class="si-value">${data.rang ?? '—'}</span>
    </div>
    <div class="si-row">
      <span class="si-label">Année scolaire :</span>
      <span class="si-value">${escapeHtml(data.annee_libelle)}</span>
    </div>
  </div>`;
}

function footerHtml(etablissementNom: string): string {
  return `
  <div class="footer">
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">La Maîtresse</div>
    </div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">Le Maître (AR)</div>
    </div>
    <div class="footer-brand">${escapeHtml(etablissementNom)}<span class="gold-dot"></span></div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">Le Directeur</div>
    </div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">Les Parents</div>
    </div>
  </div>`;
}

// ─── Tableau FR ─────────────────────────────────────────────────────────────

function tableFR(notes: NoteRow[], headerTitle = 'Évaluation des acquis — Filière Française'): string {
  const withVal = notes.filter(n => n.valeur !== null);
  const totalCoeff = withVal.reduce((s, n) => s + n.coeff, 0);
  const totalPoints = withVal.reduce((s, n) => s + (n.valeur! * n.coeff), 0);
  const moy = moyenneNorm(notes);

  const rows = notes.map(n => {
    const nmax = n.note_max ?? RENDER_BASE;
    const isFail = n.valeur !== null && n.valeur < nmax / 2;
    const appr = getApprNom(n.valeur, nmax);
    const cls = n.valeur !== null ? apprClass(n.valeur, nmax) : '';
    return `
    <tr>
      <td style="font-weight:500">${escapeHtml(n.nom_fr)}</td>
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

// ─── Tableau AR ─────────────────────────────────────────────────────────────

function tableAR(notes: NoteRow[], headerTitle = 'تقييم المكتسبات — الشعبة العربية'): string {
  const withVal = notes.filter(n => n.valeur !== null);
  const totalCoeff = withVal.reduce((s, n) => s + n.coeff, 0);
  const totalPoints = withVal.reduce((s, n) => s + (n.valeur! * n.coeff), 0);
  const moy = moyenneNorm(notes);

  const rows = notes.map(n => {
    const nmax = n.note_max ?? RENDER_BASE;
    const isFail = n.valeur !== null && n.valeur < nmax / 2;
    const appr = getApprNomAR(n.valeur, nmax);
    const cls = n.valeur !== null ? apprClass(n.valeur, nmax) : '';
    return `
    <tr>
      <td class="ar-td" style="font-weight:500">${escapeHtml(n.nom_ar)}</td>
      <td class="center">${n.coeff}</td>
      <td class="center grade ${isFail ? 'fail' : 'pass'}">
        ${n.valeur !== null ? Number(n.valeur).toFixed(2) : '—'}
      </td>
      <td class="center" style="font-size:10px;color:#6b7280">/${nmax}</td>
      <td class="ar-td ${cls}">${appr}</td>
    </tr>`;
  }).join('');

  const moyStr = moy !== null ? Number(moy).toFixed(2) : '—';
  const ptStr  = totalPoints > 0 ? Number(totalPoints).toFixed(2) : '—';
  const cfStr  = totalCoeff > 0 ? Number(totalCoeff).toFixed(1) : '—';

  return `
  <div class="eval-section">
    <div class="eval-header eval-header-ar" style="direction:rtl">${headerTitle}</div>
    <table>
      <thead><tr>
        <th class="ar-th" style="width:42%">المواد</th>
        <th class="center" style="width:8%">المعامل</th>
        <th class="center" style="width:10%">الدرجة</th>
        <th class="center" style="width:8%">/ الأقصى</th>
        <th class="ar-th" style="width:32%">الملاحظة</th>
      </tr></thead>
      <tbody>
        ${rows || '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:10px">لا توجد درجات</td></tr>'}
        <tr class="results-row results-ar">
          <td class="ar-td">النتائج</td>
          <td class="center">م: ${cfStr}</td>
          <td class="center" colspan="2">المجموع: ${ptStr}</td>
          <td class="center">المعدل: ${moyStr} / ${RENDER_BASE}</td>
        </tr>
      </tbody>
    </table>
  </div>`;
}

// ─── Tableau annuel ──────────────────────────────────────────────────────────

function tableAnnuelFR(matieres: TrimestreRow[]): string {
  const rows = matieres.map(m => `
    <tr>
      <td style="font-weight:500">${escapeHtml(m.nom_fr)}</td>
      <td class="center">${m.coeff}</td>
      ${m.valeurs.map(v => `<td class="center grade ${v !== null && v < (m.note_max ?? RENDER_BASE) / 2 ? 'fail' : 'pass'}">${v !== null ? Number(v).toFixed(2) : '—'}</td>`).join('')}
      <td class="center grade ${m.moyenne_annuelle !== null && m.moyenne_annuelle < (m.note_max ?? RENDER_BASE) / 2 ? 'fail' : 'pass'}" style="font-weight:700;background:#f0fdf4">
        ${m.moyenne_annuelle !== null ? Number(m.moyenne_annuelle).toFixed(2) : '—'}
      </td>
      <td class="${m.moyenne_annuelle !== null ? apprClass(m.moyenne_annuelle, m.note_max ?? RENDER_BASE) : ''}">
        ${getApprNom(m.moyenne_annuelle, m.note_max ?? RENDER_BASE)}
      </td>
    </tr>`).join('');
  return `
  <div class="eval-section">
    <div class="eval-header">Évaluation annuelle — Filière Française</div>
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

function tableAnnuelAR(matieres: TrimestreRow[]): string {
  const rows = matieres.map(m => `
    <tr>
      <td class="ar-td" style="font-weight:500">${escapeHtml(m.nom_ar)}</td>
      <td class="center">${m.coeff}</td>
      ${m.valeurs.map(v => `<td class="center grade ${v !== null && v < (m.note_max ?? RENDER_BASE) / 2 ? 'fail' : 'pass'}">${v !== null ? Number(v).toFixed(2) : '—'}</td>`).join('')}
      <td class="center grade ${m.moyenne_annuelle !== null && m.moyenne_annuelle < (m.note_max ?? RENDER_BASE) / 2 ? 'fail' : 'pass'}" style="font-weight:700;background:#ecfdf5">
        ${m.moyenne_annuelle !== null ? Number(m.moyenne_annuelle).toFixed(2) : '—'}
      </td>
      <td class="ar-td ${m.moyenne_annuelle !== null ? apprClass(m.moyenne_annuelle, m.note_max ?? RENDER_BASE) : ''}">
        ${getApprNomAR(m.moyenne_annuelle, m.note_max ?? RENDER_BASE)}
      </td>
    </tr>`).join('');
  return `
  <div class="eval-section">
    <div class="eval-header eval-header-ar" style="direction:rtl">التقييم السنوي — الشعبة العربية</div>
    <table>
      <thead><tr>
        <th class="ar-th" style="width:35%">المادة</th>
        <th class="center" style="width:7%">المعامل</th>
        <th class="center">ف1</th>
        <th class="center">ف2</th>
        <th class="center">ف3</th>
        <th class="center" style="background:#ecfdf5;color:#065f46">المعدل السنوي</th>
        <th class="ar-th" style="width:22%">الملاحظة</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ─── Résumé combiné ──────────────────────────────────────────────────────────

function getMention(moyenne: number | null): string {
  if (moyenne === null) return '—';
  return mentionFor(moyenne) || '—';
}

function combinedSummaryHtml(data: BulletinBaseData, frMoy: number | null, arMoy: number | null): string {
  const globalMoy = data.moyenne;
  const mention = getMention(globalMoy);
  const mentionColor = globalMoy !== null && globalMoy >= 10 ? '#059669' : '#dc2626';

  return `
  <table class="combined-summary">
    <thead>
      <tr>
        <th>Résultats FR — AR</th>
        <th>Moy. FR</th>
        <th>Moy. AR</th>
        <th>Moyenne Générale</th>
        <th>Rang</th>
        <th>Mention</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="font-weight:600">${escapeHtml(data.annee_libelle)}</td>
        <td>${frMoy !== null ? Number(frMoy).toFixed(2) : '—'}</td>
        <td>${arMoy !== null ? Number(arMoy).toFixed(2) : '—'}</td>
        <td style="font-weight:700;font-size:13px;color:${mentionColor}">${globalMoy !== null ? `${Number(globalMoy).toFixed(2)} / ${RENDER_BASE}` : '—'}</td>
        <td>${data.rang ?? '—'}</td>
        <td class="mention-cell" style="color:${mentionColor}">${mention}</td>
      </tr>
    </tbody>
  </table>`;
}

function observationHtml(appr: string | null): string {
  return `
  <div class="appreciation-box">
    <div class="appreciation-label">Observation / Appréciation du conseil de classe</div>
    <div style="font-size:11.5px;font-style:italic;color:#374151;margin-top:3px;min-height:16px">${appr ? escapeHtml(appr) : ''}</div>
    <div class="observation-line"></div>
  </div>`;
}

// ─── Exports principaux ─────────────────────────────────────────────────────

export function generateBulletinHtml(data: BulletinTrimestreData): string {
  setRenderContext(data);
  const periodeStr = periodeLabel(data.periode);
  const ecole = data.etablissement_nom_fr;

  if (data.type === 'FR') {
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><style>${CSS}</style></head><body>
      ${headerHtml(data)}
      ${titleHtml(periodeStr, data.annee_libelle)}
      ${studentInfoHtml(data)}
      ${tableFR(data.notes_fr ?? [])}
      ${observationHtml(data.appreciation)}
      ${footerHtml(ecole)}
    </body></html>`;
  }

  if (data.type === 'AR') {
    return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/><style>${CSS}</style></head><body>
      ${headerHtml(data)}
      ${titleHtml(periodeLabelAR(data.periode), data.annee_libelle)}
      ${studentInfoHtml(data)}
      ${tableAR(data.notes_ar ?? [])}
      ${observationHtml(data.appreciation)}
      ${footerHtml(ecole)}
    </body></html>`;
  }

  // COMBINE — compute sub-moyennes
  const notesFR = data.notes_fr ?? [];
  const notesAR = data.notes_ar ?? [];
  const frMoy = moyenneNorm(notesFR);
  const arMoy = moyenneNorm(notesAR);

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><style>${CSS}</style></head><body>
    ${headerHtml(data)}
    ${titleHtml(`${periodeStr} — Filières FR &amp; AR`, data.annee_libelle)}
    ${studentInfoHtml(data)}
    ${tableFR(notesFR)}
    ${tableAR(notesAR)}
    ${combinedSummaryHtml(data, frMoy, arMoy)}
    ${observationHtml(data.appreciation)}
    ${footerHtml(ecole)}
  </body></html>`;
}

export function generateBulletinAnnuelHtml(data: BulletinAnnuelData): string {
  setRenderContext(data);
  const isCombine = data.type === 'ANNUEL_COMBINE';
  const isAR = data.type === 'ANNUEL_AR';
  const ecole = data.etablissement_nom_fr;

  const mFR = data.matieres_fr ?? [];
  const mAR = data.matieres_ar ?? [];

  // Compute sub-moyennes for combined summary
  const frWithMoy = mFR.filter(m => m.moyenne_annuelle !== null);
  const arWithMoy = mAR.filter(m => m.moyenne_annuelle !== null);
  const frCoeff = frWithMoy.reduce((s, m) => s + m.coeff, 0);
  const arCoeff = arWithMoy.reduce((s, m) => s + m.coeff, 0);
  const frMoy = frCoeff > 0 ? frWithMoy.reduce((s, m) => s + m.moyenne_annuelle! * m.coeff, 0) / frCoeff : null;
  const arMoy = arCoeff > 0 ? arWithMoy.reduce((s, m) => s + m.moyenne_annuelle! * m.coeff, 0) / arCoeff : null;

  return `<!DOCTYPE html><html lang="${isAR ? 'ar' : 'fr'}" ${isAR ? 'dir="rtl"' : ''}><head><meta charset="UTF-8"/><style>${CSS}</style></head><body>
    ${headerHtml(data)}
    ${titleAnnuelHtml(data.annee_libelle)}
    ${studentInfoHtml(data)}

    ${!isAR && mFR.length > 0 ? tableAnnuelFR(mFR) : ''}
    ${(isAR || isCombine) && mAR.length > 0 ? tableAnnuelAR(mAR) : ''}

    ${isCombine ? combinedSummaryHtml(data, frMoy, arMoy) : ''}

    ${observationHtml(data.appreciation)}
    ${footerHtml(ecole)}
  </body></html>`;
}
