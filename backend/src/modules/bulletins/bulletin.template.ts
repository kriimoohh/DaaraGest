function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface NoteRow {
  nom_fr: string;
  nom_ar: string;
  filiere: string;
  coeff: number;
  valeur: number | null;
}

interface BulletinData {
  etablissement_nom_fr: string;
  etablissement_nom_ar: string;
  eleve_nom_fr: string;
  eleve_nom_ar: string;
  eleve_matricule: string;
  annee_libelle: string;
  periode: number;
  filiere: string;
  moyenne: number | null;
  rang: number | null;
  appreciation: string | null;
  notes: NoteRow[];
  devise: string;
}

const periodeLabels: Record<number, string> = {
  1: '1er Trimestre',
  2: '2ème Trimestre',
  3: '3ème Trimestre',
};

export function generateBulletinHtml(data: BulletinData): string {
  const noteRows = data.notes
    .map(
      (n) => `
      <tr>
        <td class="subject">${escapeHtml(n.nom_fr)}</td>
        <td class="subject-ar" dir="rtl">${escapeHtml(n.nom_ar)}</td>
        <td class="center">${n.coeff}</td>
        <td class="center grade ${n.valeur !== null && n.valeur < 10 ? 'fail' : 'pass'}">
          ${n.valeur !== null ? Number(n.valeur).toFixed(2) : '—'}
        </td>
        <td class="center">${n.valeur !== null ? (Number(n.valeur) * n.coeff).toFixed(2) : '—'}</td>
      </tr>`
    )
    .join('');

  const moyenneClass =
    data.moyenne === null ? '' : data.moyenne >= 10 ? 'pass' : 'fail';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Arial', sans-serif;
      font-size: 13px;
      color: #1a1a1a;
      padding: 30px 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #059669;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .school-name { font-size: 20px; font-weight: bold; color: #059669; }
    .school-name-ar { font-size: 18px; direction: rtl; color: #059669; }
    .badge {
      background: #059669;
      color: white;
      padding: 6px 14px;
      border-radius: 6px;
      font-weight: bold;
      font-size: 14px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 24px;
    }
    .info-box {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px 16px;
    }
    .info-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
    .info-value { font-size: 15px; font-weight: 600; color: #111827; margin-top: 2px; }
    .info-value-ar { font-size: 14px; font-weight: 600; color: #374151; direction: rtl; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    thead { background: #f0fdf4; }
    th {
      padding: 10px 12px;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #374151;
      border-bottom: 2px solid #059669;
    }
    td {
      padding: 9px 12px;
      border-bottom: 1px solid #f3f4f6;
    }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) { background: #f9fafb; }
    .center { text-align: center; }
    .subject { font-weight: 500; }
    .subject-ar { font-size: 12px; color: #6b7280; text-align: right; }
    .grade { font-weight: 700; font-size: 14px; }
    .pass { color: #059669; }
    .fail { color: #dc2626; }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .summary-box {
      border-radius: 8px;
      padding: 14px 16px;
      text-align: center;
    }
    .summary-box.moyenne { background: #f0fdf4; border: 2px solid #059669; }
    .summary-box.rang { background: #eff6ff; border: 2px solid #3b82f6; }
    .summary-box.filiere { background: #fefce8; border: 2px solid #f59e0b; }
    .summary-label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
    .summary-value { font-size: 24px; font-weight: 800; margin-top: 4px; }
    .appreciation-box {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 14px 16px;
      background: #fafafa;
      margin-bottom: 24px;
    }
    .appreciation-label { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 6px; }
    .appreciation-text { font-size: 14px; font-style: italic; color: #374151; }
    .footer {
      display: flex;
      justify-content: space-between;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
    }
    .signature-box { text-align: center; }
    .signature-line {
      width: 140px;
      border-bottom: 1px solid #1a1a1a;
      margin: 32px auto 6px;
    }
    .signature-label { font-size: 11px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="school-name">${escapeHtml(data.etablissement_nom_fr)}</div>
      <div class="school-name-ar">${escapeHtml(data.etablissement_nom_ar)}</div>
    </div>
    <div class="badge">Bulletin scolaire</div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="info-label">Élève</div>
      <div class="info-value">${escapeHtml(data.eleve_nom_fr)}</div>
      <div class="info-value-ar">${escapeHtml(data.eleve_nom_ar)}</div>
    </div>
    <div class="info-box">
      <div class="info-label">Matricule</div>
      <div class="info-value">${escapeHtml(data.eleve_matricule)}</div>
    </div>
    <div class="info-box">
      <div class="info-label">Année scolaire</div>
      <div class="info-value">${escapeHtml(data.annee_libelle)}</div>
    </div>
    <div class="info-box">
      <div class="info-label">Période</div>
      <div class="info-value">${periodeLabels[data.periode] ?? `Période ${data.periode}`}</div>
    </div>
  </div>

  <div class="summary">
    <div class="summary-box moyenne">
      <div class="summary-label">Moyenne générale</div>
      <div class="summary-value ${moyenneClass}">
        ${data.moyenne !== null ? Number(data.moyenne).toFixed(2) : 'N/A'}
        ${data.moyenne !== null ? '<span style="font-size:14px;font-weight:400">/20</span>' : ''}
      </div>
    </div>
    <div class="summary-box rang">
      <div class="summary-label">Rang</div>
      <div class="summary-value" style="color:#3b82f6">
        ${data.rang ?? '—'}
      </div>
    </div>
    <div class="summary-box filiere">
      <div class="summary-label">Filière</div>
      <div class="summary-value" style="color:#f59e0b;font-size:18px">
        ${data.filiere === 'FR' ? 'Française' : 'Arabe'}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Matière</th>
        <th>المادة</th>
        <th class="center">Coeff.</th>
        <th class="center">Note /20</th>
        <th class="center">Points</th>
      </tr>
    </thead>
    <tbody>
      ${noteRows || '<tr><td colspan="5" style="text-align:center;color:#6b7280;padding:16px">Aucune note enregistrée</td></tr>'}
    </tbody>
  </table>

  ${
    data.appreciation
      ? `<div class="appreciation-box">
    <div class="appreciation-label">Appréciation du conseil de classe</div>
    <div class="appreciation-text">${escapeHtml(data.appreciation ?? "")}</div>
  </div>`
      : ''
  }

  <div class="footer">
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">Le Directeur</div>
    </div>
    <div style="text-align:center;font-size:11px;color:#9ca3af;align-self:flex-end">
      Généré par DaaraGest · ${new Date().toLocaleDateString('fr-FR')}
    </div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="signature-label">Signature du parent</div>
    </div>
  </div>
</body>
</html>`;
}
