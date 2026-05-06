function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
  etablissement_nom_ar: string;
  eleve_nom_fr: string;
  eleve_nom_ar: string;
  eleve_matricule: string;
  annee_libelle: string;
  moyenne: number | null;
  rang: number | null;
  appreciation: string | null;
  devise: string;
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

const moyenneClass = (m: number | null) =>
  !m ? '' : m >= 10 ? 'pass' : 'fail';

// ─── CSS commun ─────────────────────────────────────────────────────────────

const CSS = `
* { margin:0;padding:0;box-sizing:border-box }
body { font-family:Arial,sans-serif;font-size:12px;color:#111;padding:28px 36px }
.header { display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #10B981;padding-bottom:14px;margin-bottom:18px }
.school-name { font-size:18px;font-weight:bold;color:#10B981 }
.badge { background:#10B981;color:#fff;padding:5px 12px;border-radius:6px;font-weight:bold;font-size:13px }
.badge-ar { background:#0F172A }
.badge-combine { background:linear-gradient(90deg,#10B981,#0F172A) }
.info-grid { display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px }
.info-box { border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px }
.info-label { font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em }
.info-value { font-size:14px;font-weight:600;color:#111;margin-top:2px }
table { width:100%;border-collapse:collapse;margin-bottom:18px }
thead { background:#f0fdf4 }
th { padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#374151;border-bottom:2px solid #10B981 }
th.ar-th { text-align:right;direction:rtl;background:#f8fafc;border-bottom-color:#0F172A }
td { padding:8px 10px;border-bottom:1px solid #f3f4f6 }
td.ar-td { text-align:right;direction:rtl;color:#374151 }
tr:last-child td { border-bottom:none }
tr:nth-child(even) { background:#f9fafb }
.center { text-align:center }
.grade { font-weight:700;font-size:13px }
.pass { color:#10B981 }
.fail { color:#dc2626 }
.section-title { font-size:12px;font-weight:700;padding:6px 10px;margin-bottom:-1px;border-radius:6px 6px 0 0 }
.section-fr { background:#f0fdf4;color:#059669;border:1px solid #10B981 }
.section-ar { background:#f8fafc;color:#0F172A;border:1px solid #0F172A;direction:rtl;text-align:right }
.summary { display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px }
.summary-box { border-radius:8px;padding:12px 14px;text-align:center }
.summary-box.moy { background:#f0fdf4;border:2px solid #10B981 }
.summary-box.rang { background:#eff6ff;border:2px solid #3b82f6 }
.summary-box.fil { background:#fefce8;border:2px solid #F59E0B }
.summary-label { font-size:10px;color:#6b7280;text-transform:uppercase }
.summary-value { font-size:22px;font-weight:800;margin-top:3px }
.appreciation-box { border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;background:#fafafa;margin-bottom:18px }
.appreciation-label { font-size:10px;color:#6b7280;text-transform:uppercase;margin-bottom:4px }
.footer { display:flex;justify-content:space-between;margin-top:28px;padding-top:14px;border-top:1px solid #e5e7eb }
.signature-box { text-align:center }
.signature-line { width:130px;border-bottom:1px solid #111;margin:28px auto 5px }
.signature-label { font-size:10px;color:#6b7280 }
.gold-dot { display:inline-block;width:8px;height:8px;border-radius:50%;background:#F59E0B;margin:0 4px }
`;

// ─── Header commun ─────────────────────────────────────────────────────────

function headerHtml(data: BulletinBaseData, badge: string, badgeClass = ''): string {
  return `
  <div class="header">
    <div>
      <div class="school-name">${escapeHtml(data.etablissement_nom_fr)}</div>
      <div style="font-size:14px;color:#0F172A;direction:rtl;margin-top:2px">${escapeHtml(data.etablissement_nom_ar)}</div>
    </div>
    <div class="badge ${badgeClass}">${badge}</div>
  </div>
  <div class="info-grid">
    <div class="info-box">
      <div class="info-label">Élève</div>
      <div class="info-value">${escapeHtml(data.eleve_nom_fr)}</div>
    </div>
    <div class="info-box">
      <div class="info-label">Matricule</div>
      <div class="info-value">${escapeHtml(data.eleve_matricule)}</div>
    </div>
    <div class="info-box">
      <div class="info-label">Année scolaire</div>
      <div class="info-value">${escapeHtml(data.annee_libelle)}</div>
    </div>`;
}

function summaryHtml(data: BulletinBaseData, filiereLabel: string): string {
  const m = data.moyenne;
  return `
  <div class="summary">
    <div class="summary-box moy">
      <div class="summary-label">Moyenne générale</div>
      <div class="summary-value ${moyenneClass(m)}">
        ${m !== null ? Number(m).toFixed(2) : 'N/A'}${m !== null ? '<span style="font-size:12px;font-weight:400">/20</span>' : ''}
      </div>
    </div>
    <div class="summary-box rang">
      <div class="summary-label">Rang</div>
      <div class="summary-value" style="color:#3b82f6">${data.rang ?? '—'}</div>
    </div>
    <div class="summary-box fil">
      <div class="summary-label">Filière</div>
      <div class="summary-value" style="color:#F59E0B;font-size:14px">${filiereLabel}</div>
    </div>
  </div>`;
}

function appreciationHtml(appr: string | null): string {
  if (!appr) return '';
  return `
  <div class="appreciation-box">
    <div class="appreciation-label">Appréciation du conseil de classe</div>
    <div style="font-size:13px;font-style:italic;color:#374151;margin-top:4px">${escapeHtml(appr)}</div>
  </div>`;
}

function footerHtml(annee: string): string {
  return `
  <div class="footer">
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">Le Directeur</div>
    </div>
    <div style="text-align:center;font-size:10px;color:#9ca3af;align-self:flex-end">
      DaaraGest <span class="gold-dot"></span> ${new Date().toLocaleDateString('fr-FR')}
    </div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">Signature du parent</div>
    </div>
  </div>`;
}

// ─── Tableau FR ─────────────────────────────────────────────────────────────

function tableFR(notes: NoteRow[]): string {
  const rows = notes.map(n => `
    <tr>
      <td style="font-weight:500">${escapeHtml(n.nom_fr)}</td>
      <td class="center">${n.coeff}</td>
      <td class="center grade ${n.valeur !== null && n.valeur < (n.note_max ?? 20) / 2 ? 'fail' : 'pass'}">
        ${n.valeur !== null ? Number(n.valeur).toFixed(2) : '—'}<span style="font-size:9px;color:#9ca3af">/${n.note_max ?? 20}</span>
      </td>
      <td class="center">${n.valeur !== null ? (Number(n.valeur) * n.coeff).toFixed(2) : '—'}</td>
    </tr>`).join('');
  return `
  <table>
    <thead><tr>
      <th>Matière</th>
      <th class="center">Coeff.</th>
      <th class="center">Note /20</th>
      <th class="center">Points</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:12px">Aucune note</td></tr>'}</tbody>
  </table>`;
}

// ─── Tableau AR ─────────────────────────────────────────────────────────────

function tableAR(notes: NoteRow[]): string {
  const rows = notes.map(n => `
    <tr>
      <td class="ar-td" style="font-weight:500">${escapeHtml(n.nom_ar)}</td>
      <td class="center">${n.coeff}</td>
      <td class="center grade ${n.valeur !== null && n.valeur < (n.note_max ?? 20) / 2 ? 'fail' : 'pass'}">
        ${n.valeur !== null ? Number(n.valeur).toFixed(2) : '—'}<span style="font-size:9px;color:#9ca3af">/${n.note_max ?? 20}</span>
      </td>
      <td class="center">${n.valeur !== null ? (Number(n.valeur) * n.coeff).toFixed(2) : '—'}</td>
    </tr>`).join('');
  return `
  <table>
    <thead><tr>
      <th class="ar-th">المادة</th>
      <th class="center">المعامل</th>
      <th class="center">الدرجة /20</th>
      <th class="center">النقاط</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:12px">لا توجد درجات</td></tr>'}</tbody>
  </table>`;
}

// ─── Tableau annuel ──────────────────────────────────────────────────────────

function tableAnnuelFR(matieres: TrimestreRow[]): string {
  const rows = matieres.map(m => `
    <tr>
      <td style="font-weight:500">${escapeHtml(m.nom_fr)}</td>
      <td class="center">${m.coeff}</td>
      ${m.valeurs.map(v => `<td class="center grade ${v !== null && v < 10 ? 'fail' : 'pass'}">${v !== null ? Number(v).toFixed(2) : '—'}</td>`).join('')}
      <td class="center grade ${m.moyenne_annuelle !== null && m.moyenne_annuelle < 10 ? 'fail' : 'pass'}" style="font-weight:700;background:#f0fdf4">
        ${m.moyenne_annuelle !== null ? Number(m.moyenne_annuelle).toFixed(2) : '—'}
      </td>
    </tr>`).join('');
  return `
  <table>
    <thead><tr>
      <th>Matière</th>
      <th class="center">Coeff.</th>
      <th class="center">T1</th>
      <th class="center">T2</th>
      <th class="center">T3</th>
      <th class="center" style="background:#f0fdf4;color:#059669">Moy. Ann.</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function tableAnnuelAR(matieres: TrimestreRow[]): string {
  const rows = matieres.map(m => `
    <tr>
      <td class="ar-td" style="font-weight:500">${escapeHtml(m.nom_ar)}</td>
      <td class="center">${m.coeff}</td>
      ${m.valeurs.map(v => `<td class="center grade ${v !== null && v < 10 ? 'fail' : 'pass'}">${v !== null ? Number(v).toFixed(2) : '—'}</td>`).join('')}
      <td class="center grade ${m.moyenne_annuelle !== null && m.moyenne_annuelle < 10 ? 'fail' : 'pass'}" style="font-weight:700;background:#f8fafc">
        ${m.moyenne_annuelle !== null ? Number(m.moyenne_annuelle).toFixed(2) : '—'}
      </td>
    </tr>`).join('');
  return `
  <table>
    <thead><tr>
      <th class="ar-th">المادة</th>
      <th class="center">المعامل</th>
      <th class="center">ف1</th>
      <th class="center">ف2</th>
      <th class="center">ف3</th>
      <th class="center" style="background:#f8fafc;color:#0F172A">المعدل السنوي</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ─── Exports principaux ─────────────────────────────────────────────────────

export function generateBulletinHtml(data: BulletinTrimestreData): string {
  const periodeStr = periodeLabel(data.periode);

  if (data.type === 'FR') {
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><style>${CSS}</style></head><body>
      ${headerHtml(data, `Bulletin — ${periodeStr}`, '')}
        <div class="info-box"><div class="info-label">Période</div><div class="info-value">${periodeStr}</div></div>
      </div>
      ${summaryHtml(data, 'Française')}
      ${tableFR(data.notes_fr ?? [])}
      ${appreciationHtml(data.appreciation)}
      ${footerHtml(data.annee_libelle)}
    </body></html>`;
  }

  if (data.type === 'AR') {
    return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/><style>${CSS}</style></head><body>
      ${headerHtml(data, `شهادة النتائج — ${periodeStr}`, 'badge-ar')}
        <div class="info-box"><div class="info-label">الفصل</div><div class="info-value" style="direction:rtl">${periodeStr}</div></div>
      </div>
      ${summaryHtml(data, 'عربية')}
      ${tableAR(data.notes_ar ?? [])}
      ${appreciationHtml(data.appreciation)}
      ${footerHtml(data.annee_libelle)}
    </body></html>`;
  }

  // COMBINE
  const mFR = data.notes_fr ?? [];
  const mAR = data.notes_ar ?? [];
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><style>${CSS}</style></head><body>
    ${headerHtml(data, `Bulletin combiné — ${periodeStr}`, 'badge-combine')}
      <div class="info-box"><div class="info-label">Période</div><div class="info-value">${periodeStr}</div></div>
    </div>
    ${summaryHtml(data, 'FR + AR')}
    <div class="section-title section-fr">📘 Filière Française</div>
    ${tableFR(mFR)}
    <div class="section-title section-ar" style="margin-top:12px">📗 الشعبة العربية</div>
    ${tableAR(mAR)}
    ${appreciationHtml(data.appreciation)}
    ${footerHtml(data.annee_libelle)}
  </body></html>`;
}

export function generateBulletinAnnuelHtml(data: BulletinAnnuelData): string {
  const isCombine = data.type === 'ANNUEL_COMBINE';
  const isAR = data.type === 'ANNUEL_AR';
  const badge = isCombine ? 'Bulletin Annuel — FR + AR' : isAR ? 'الشهادة السنوية' : 'Bulletin Annuel';
  const badgeClass = isCombine ? 'badge-combine' : isAR ? 'badge-ar' : '';

  return `<!DOCTYPE html><html lang="${isAR ? 'ar' : 'fr'}" ${isAR ? 'dir="rtl"' : ''}><head><meta charset="UTF-8"/><style>${CSS}</style></head><body>
    ${headerHtml(data, badge, badgeClass)}
      <div class="info-box"><div class="info-label">Bilan</div><div class="info-value">Année complète — 3 trimestres</div></div>
    </div>
    ${summaryHtml(data, isCombine ? 'FR + AR' : isAR ? 'عربية' : 'Française')}

    ${!isAR && data.matieres_fr && data.matieres_fr.length > 0 ? `
      ${isCombine ? '<div class="section-title section-fr">📘 Filière Française</div>' : ''}
      ${tableAnnuelFR(data.matieres_fr)}
    ` : ''}

    ${(isAR || isCombine) && data.matieres_ar && data.matieres_ar.length > 0 ? `
      ${isCombine ? '<div class="section-title section-ar" style="margin-top:12px">📗 الشعبة العربية</div>' : ''}
      ${tableAnnuelAR(data.matieres_ar)}
    ` : ''}

    ${appreciationHtml(data.appreciation)}
    ${footerHtml(data.annee_libelle)}
  </body></html>`;
}
