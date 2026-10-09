import prisma from '../../config/database';
import { logAction } from '../../utils/audit';
import { PaiementEleveInput, BulkPaiementEleveInput, UpdatePaiementEleveInput, PaiementPersonnelInput } from './finances.schema';
import { NotFoundError } from '../../utils/errors';

async function genererRecu(): Promise<string> {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const result = await prisma.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('seq_recu_numero')`;
  const seq = String(result[0].nextval).padStart(6, '0');
  return `REC-${ymd}-${seq}`;
}

export type PaiementEleveFiltres = { search?: string; type?: string; mois?: number; annee?: number; statut?: string };

const PAIEMENT_ELEVE_INCLUDE = {
  eleve: { select: { id: true, nom_fr: true, prenom_fr: true, matricule: true } },
} as const;

// Construit le filtre Prisma commun (liste paginée + exports).
function buildPaiementEleveWhere(etablissement_id: string, f: PaiementEleveFiltres): Record<string, unknown> {
  const eleveWhere: Record<string, unknown> = { etablissement_id };
  if (f.search) {
    eleveWhere.OR = [
      { nom_fr: { contains: f.search, mode: 'insensitive' } },
      { matricule: { contains: f.search, mode: 'insensitive' } },
    ];
  }
  const where: Record<string, unknown> = { eleve: eleveWhere };
  if (f.type) where.type = f.type;
  if (f.mois) where.mois = f.mois;
  if (f.annee) where.annee = f.annee;
  if (f.statut === 'paye') where.statut = 'paye';
  if (f.statut === 'impaye') where.statut = { not: 'paye' };
  return where;
}

export async function listerPaiementsEleves(
  etablissement_id: string,
  page = 1,
  search?: string,
  type?: string,
  mois?: number,
  annee?: number,
  statut?: string,
) {
  const limit = 20;
  const skip = (page - 1) * limit;
  const where = buildPaiementEleveWhere(etablissement_id, { search, type, mois, annee, statut });

  const [total, items] = await Promise.all([
    prisma.paiementEleve.count({ where }),
    prisma.paiementEleve.findMany({
      where,
      skip,
      take: limit,
      include: PAIEMENT_ELEVE_INCLUDE,
      orderBy: { created_at: 'desc' },
    }),
  ]);

  return { total, page, limit, data: items };
}

// Tous les paiements correspondant aux filtres (sans pagination) — pour les exports.
export async function listerTousPaiementsElevesFiltres(etablissement_id: string, f: PaiementEleveFiltres) {
  return prisma.paiementEleve.findMany({
    where: buildPaiementEleveWhere(etablissement_id, f),
    include: PAIEMENT_ELEVE_INCLUDE,
    orderBy: { created_at: 'desc' },
  });
}

// PDF imprimable de la liste des paiements filtrés (A4 paysage).
export async function genererPdfPaiementsEleves(etablissement_id: string, f: PaiementEleveFiltres): Promise<Buffer> {
  const [etab, paiements] = await Promise.all([
    prisma.etablissement.findUnique({ where: { id: etablissement_id }, select: { nom_fr: true, devise: true } }),
    listerTousPaiementsElevesFiltres(etablissement_id, f),
  ]);
  const { renderPdfHtml } = await import('../../utils/browserPool');
  const { escapeHtml: esc } = await import('../../utils/escapeHtml');
  const devise = etab?.devise ?? 'FCFA';
  const fmt = (n: number) => Number(n).toLocaleString('fr-FR');
  const total = paiements.reduce((s, p) => s + Number(p.montant), 0);
  const statutFr = (s: string) => (s === 'paye' ? 'Payé' : s === 'impaye' ? 'Non payé' : s);
  const filtreLabel = [
    f.statut ? `Statut : ${statutFr(f.statut)}` : null,
    f.type ? `Type : ${f.type}` : null,
    f.mois ? `Mois : ${f.mois}` : null,
    f.annee ? `Année : ${f.annee}` : null,
    f.search ? `Recherche : ${f.search}` : null,
  ].filter(Boolean).join(' · ') || 'Tous';
  const rows = paiements.map((p, i) => `<tr>
    <td>${i + 1}</td>
    <td>${esc(p.recu_numero ?? '')}</td>
    <td class="l">${esc(p.eleve?.prenom_fr ?? '')} ${esc(p.eleve?.nom_fr ?? '')}</td>
    <td>${esc(p.eleve?.matricule ?? '')}</td>
    <td class="l">${esc(p.type)}</td>
    <td class="r">${fmt(Number(p.montant))}</td>
    <td>${statutFr(p.statut)}</td>
    <td>${p.mois ?? ''}/${p.annee ?? ''}</td>
    <td>${new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
  </tr>`).join('');
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:9px;color:#000;padding:8mm 10mm}
    h1{font-size:13px;text-align:center;margin-bottom:2px}
    .meta{text-align:center;font-size:9px;color:#374151;margin-bottom:8px}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #333;padding:3px 4px;text-align:center;font-size:8.5px}
    th{background:#0F172A;color:#fff}
    td.l{text-align:left}td.r{text-align:right;font-family:monospace}
    tr:nth-child(even){background:#f6f6f6}
    tfoot td{font-weight:bold;background:#e8f5e9}
  </style></head><body>
    <h1>${esc(etab?.nom_fr ?? '')}</h1>
    <div class="meta">Liste des paiements élèves — ${esc(filtreLabel)} · ${paiements.length} paiement(s)</div>
    <table>
      <thead><tr><th>N°</th><th>N° Reçu</th><th>Élève</th><th>Matricule</th><th>Type</th><th>Montant (${esc(devise)})</th><th>Statut</th><th>Mois/Année</th><th>Date</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="9" style="padding:10px">Aucun paiement</td></tr>'}</tbody>
      <tfoot><tr><td colspan="5" class="r">TOTAL</td><td class="r">${fmt(total)}</td><td colspan="3"></td></tr></tfoot>
    </table>
  </body></html>`;
  return renderPdfHtml(html, { format: 'A4', landscape: true, printBackground: true, margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' } });
}

type ReliquatExportFiltres = { annee_scolaire_id?: string; mois?: number; annee?: number };

const MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_C = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

// Libellés lisibles des types de paiement ('inscription', 'mensualite'…) ; repli = code brut.
const TYPE_LABELS_RECU: Record<string, string> = {
  inscription: 'Frais d\'inscription', mensualite: 'Mensualité', scolarite: 'Scolarité',
  examen: 'Frais d\'examen', uniforme: 'Uniforme', transport: 'Transport', cantine: 'Cantine', autre: 'Autre',
};

/** Données du reçu d'un paiement : élève, classes (via l'inscription ou l'année active), établissement. */
export async function getDonneesRecu(id: string, etablissement_id: string) {
  const paiement = await prisma.paiementEleve.findFirst({
    where: { id, eleve: { etablissement_id } },
    include: {
      eleve: { select: { nom_fr: true, prenom_fr: true, matricule: true } },
      inscription: { include: { annee_scolaire: { select: { libelle: true } }, classes: { include: { classe: { select: { nom_fr: true } } } } } },
    },
  });
  if (!paiement) throw new NotFoundError('Paiement introuvable');

  // Paiement non rattaché à une inscription (ex. mensualité) : on retombe sur l'inscription
  // de l'année active pour afficher la classe.
  let inscription = paiement.inscription;
  if (!inscription) {
    inscription = await prisma.inscription.findFirst({
      where: { eleve_id: paiement.eleve_id, annee_scolaire: { etablissement_id, active: true } },
      include: { annee_scolaire: { select: { libelle: true } }, classes: { include: { classe: { select: { nom_fr: true } } } } },
    });
  }
  const etab = await prisma.etablissement.findUnique({
    where: { id: etablissement_id },
    select: { nom_fr: true, adresse: true, telephone: true, devise: true, logo_url: true, cachet_url: true },
  });
  return { paiement, inscription, etab };
}

// Reçu individuel (A5 portrait) à remettre au parent.
export async function genererPdfRecu(id: string, etablissement_id: string): Promise<Buffer> {
  const { paiement: p, inscription, etab } = await getDonneesRecu(id, etablissement_id);
  const { renderPdfHtml } = await import('../../utils/browserPool');
  const { escapeHtml: esc } = await import('../../utils/escapeHtml');
  const devise = etab?.devise ?? 'FCFA';
  const montant = Number(p.montant).toLocaleString('fr-FR');
  const classes = (inscription?.classes ?? []).map(c => c.classe.nom_fr).join(' · ');
  const periode = p.mois && p.annee ? `${MOIS_LONG[p.mois - 1]} ${p.annee}` : null;
  const date = new Date(p.created_at).toLocaleDateString('fr-FR');
  const ligne = (k: string, v: string | null | undefined) => (v ? `<tr><th>${k}</th><td>${esc(v)}</td></tr>` : '');
  const { logoMarkSvg } = await import('../bulletins/bulletin.template');
  // Identité visuelle du site (cf. DESIGN.md : tokens clairs, Fraunces / Instrument Sans /
  // JetBrains Mono). Hex en dur assumés : template d'impression ouvert hors app.
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
    @page{size:A5;margin:0}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{width:148mm;height:210mm;overflow:hidden}
    body{font-family:'Instrument Sans',Arial,sans-serif;font-size:12px;color:#1B1812;background:#FAF6EE;-webkit-print-color-adjust:exact;print-color-adjust:exact;position:relative}
    .band{height:8mm;background:#B85433;border-bottom:1.2mm solid #C8932B}
    
    .wrap{padding:9mm 12mm 0}
    .head{display:flex;align-items:center;gap:12px;padding-bottom:10px;border-bottom:1px solid #C9BB9D}
    .head img{width:56px;height:56px;object-fit:contain}
    .head .nom{font-family:'Fraunces',Georgia,serif;font-size:17px;font-weight:700;line-height:1.15}
    .head .sub{font-size:10px;color:#6A604F;margin-top:3px}
    .titre{display:flex;justify-content:space-between;align-items:flex-end;margin:14px 0 10px}
    h1{font-family:'Fraunces',Georgia,serif;font-size:24px;font-weight:600;letter-spacing:.2px}
    .num{font-family:'JetBrains Mono',monospace;font-size:11px;color:#8C3E25;background:#F4DACD;border-radius:6px;padding:4px 8px}
    table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #E0D5BD;border-radius:8px}
    th,td{padding:7px 10px;border-bottom:1px solid #E0D5BD;text-align:left;vertical-align:top}
    tr:last-child th,tr:last-child td{border-bottom:0}
    th{width:34%;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:500;text-transform:uppercase;letter-spacing:.6px;color:#6A604F;background:#F3ECDD}
    td{font-weight:500}
    .montant{margin:14px 0 6px;padding:12px;background:#F4DACD;border:1px solid #B85433;border-radius:12px;text-align:center}
    .montant .lbl{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:#6B2E1B}
    .montant .val{font-family:'Fraunces',Georgia,serif;font-size:28px;font-weight:700;color:#6B2E1B;margin-top:2px}
    .statut{text-align:center;font-size:10.5px;color:#8A5A12;margin-top:4px}
    .sign{display:flex;justify-content:space-between;gap:14mm;margin-top:10px}
    .sign div{flex:1;text-align:center;font-size:10px;color:#6A604F}
    .sign .zone{height:17mm;border-bottom:1px solid #C9BB9D;display:flex;align-items:center;justify-content:center}
    .sign img{max-height:16mm;max-width:100%;object-fit:contain}
    .foot{position:absolute;left:12mm;right:12mm;bottom:7mm;text-align:center;font-size:9px;color:#8C7E66;border-top:1px solid #E0D5BD;padding-top:5px}
  </style></head><body>
    <div class="band"></div>
    <div class="wrap">
      <div class="head">
        ${etab?.logo_url ? `<img src="${esc(etab.logo_url)}" alt=""/>` : logoMarkSvg(56)}
        <div><div class="nom">${esc(etab?.nom_fr ?? '')}</div>
        <div class="sub">${esc([etab?.adresse, etab?.telephone].filter(Boolean).join(' · '))}</div></div>
      </div>
      <div class="titre"><h1>Reçu de paiement</h1><div class="num">${esc(p.recu_numero ?? '')}</div></div>
      <table>
        ${ligne('Élève', `${p.eleve.prenom_fr} ${p.eleve.nom_fr}`)}
        ${ligne('Matricule', p.eleve.matricule)}
        ${ligne('Classe', classes)}
        ${ligne('Année scolaire', inscription?.annee_scolaire.libelle)}
        ${ligne('Motif', TYPE_LABELS_RECU[p.type] ?? p.type)}
        ${ligne('Période', periode)}
        ${ligne('Date', date)}
      </table>
      <div class="montant"><div class="lbl">Montant reçu</div><div class="val">${montant} ${esc(devise)}</div></div>
      ${p.statut === 'impaye' ? '<div class="statut">Paiement enregistré comme NON PAYÉ</div>' : ''}
      <div class="sign">
        <div><div class="zone"></div>Le parent / payeur</div>
        <div><div class="zone">${etab?.cachet_url ? `<img src="${esc(etab.cachet_url)}" alt=""/>` : ''}</div>Cachet et signature</div>
      </div>
    </div>
    <div class="foot">Merci de conserver ce reçu — document généré par DaaraGest</div>
  </body></html>`;
  return renderPdfHtml(html, { format: 'A5', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
}


export async function genererExcelReliquats(etablissement_id: string, f: ReliquatExportFiltres): Promise<Buffer> {
  const [etab, reliquats] = await Promise.all([
    prisma.etablissement.findUnique({ where: { id: etablissement_id }, select: { nom_fr: true } }),
    getReliquats(etablissement_id, f.annee_scolaire_id, f.mois, f.annee),
  ]);
  const { exportReliquatsExcel } = await import('../../utils/excel');
  return exportReliquatsExcel(reliquats, etab?.nom_fr ?? '');
}

// PDF imprimable de la liste des élèves en retard de paiement (reliquats).
export async function genererPdfReliquats(etablissement_id: string, f: ReliquatExportFiltres): Promise<Buffer> {
  const [etab, reliquats] = await Promise.all([
    prisma.etablissement.findUnique({ where: { id: etablissement_id }, select: { nom_fr: true } }),
    getReliquats(etablissement_id, f.annee_scolaire_id, f.mois, f.annee),
  ]);
  const { renderPdfHtml } = await import('../../utils/browserPool');
  const { escapeHtml: esc } = await import('../../utils/escapeHtml');
  const fmt = (n: number) => Number(n).toLocaleString('fr-FR');
  const total = reliquats.reduce((s, r) => s + r.montant_du, 0);
  const periodeLabel = f.mois && f.annee ? `${MOIS_LONG[f.mois - 1]} ${f.annee}` : "Année scolaire en cours";
  const rows = reliquats.map((r, i) => `<tr>
    <td>${i + 1}</td>
    <td class="l">${esc(r.eleve.prenom_fr)} ${esc(r.eleve.nom_fr)}</td>
    <td>${esc(r.eleve.matricule)}</td>
    <td>${r.nb_mois_dus}</td>
    <td class="l">${esc(r.mois_manquants.map(m => `${MOIS_C[m.mois - 1]} ${m.annee}`).join(', '))}</td>
    <td class="r">${fmt(r.montant_du)}</td>
  </tr>`).join('');
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:9px;color:#000;padding:8mm 10mm}
    h1{font-size:13px;text-align:center;margin-bottom:2px}
    .meta{text-align:center;font-size:9px;color:#374151;margin-bottom:8px}
    table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #333;padding:3px 4px;text-align:center;font-size:8.5px}
    th{background:#B91C1C;color:#fff}
    td.l{text-align:left}td.r{text-align:right;font-family:monospace}
    tr:nth-child(even){background:#fef2f2}
    tfoot td{font-weight:bold;background:#fee2e2}
  </style></head><body>
    <h1>${esc(etab?.nom_fr ?? '')}</h1>
    <div class="meta">Élèves en retard de paiement — ${esc(periodeLabel)} · ${reliquats.length} élève(s)</div>
    <table>
      <thead><tr><th>N°</th><th>Élève</th><th>Matricule</th><th>Mois dus</th><th>Mois manquants</th><th>Montant dû (FCFA)</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" style="padding:10px">Aucun reliquat — tous les élèves sont à jour</td></tr>'}</tbody>
      <tfoot><tr><td colspan="5" class="r">TOTAL DÛ</td><td class="r">${fmt(total)}</td></tr></tfoot>
    </table>
  </body></html>`;
  return renderPdfHtml(html, { format: 'A4', landscape: true, printBackground: true, margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' } });
}

export async function creerPaiementEleve(etablissement_id: string, data: PaiementEleveInput, acteurId: string) {
  const eleve = await prisma.eleve.findFirst({ where: { id: data.eleve_id, etablissement_id } });
  if (!eleve) throw new NotFoundError('Élève introuvable');

  const paiement = await prisma.paiementEleve.create({
    data: {
      eleve_id: data.eleve_id,
      inscription_id: data.inscription_id,
      type: data.type,
      montant: data.montant,
      mois: data.mois,
      annee: data.annee,
      recu_numero: data.recu_numero || await genererRecu(),
    },
    include: { eleve: true },
  });
  await logAction(etablissement_id, acteurId, 'CREATE', 'PaiementEleve', paiement.id, {
    eleve_id: data.eleve_id, type: data.type, montant: String(data.montant), recu: paiement.recu_numero,
  });
  return paiement;
}

export async function bulkCreerPaiementEleve(etablissement_id: string, data: BulkPaiementEleveInput, acteurId: string) {
  const eleves = await prisma.eleve.findMany({
    where: { id: { in: data.eleve_ids }, etablissement_id },
    select: { id: true },
  });
  if (eleves.length === 0) throw new Error('Aucun élève valide trouvé');

  // Les numéros de reçu sont générés via une séquence PostgreSQL non transactionnelle
  // (les séquences ne rollback pas), donc on les génère avant la transaction.
  const recuNumeros = await Promise.all(eleves.map(() => genererRecu()));

  const created = await prisma.$transaction(
    eleves.map((e, i) =>
      prisma.paiementEleve.create({
        data: {
          eleve_id: e.id,
          inscription_id: data.inscription_id,
          type: data.type,
          montant: data.montant,
          mois: data.mois,
          annee: data.annee,
          recu_numero: recuNumeros[i],
        },
        include: { eleve: { select: { id: true, nom_fr: true, matricule: true } } },
      })
    )
  );

  await logAction(etablissement_id, acteurId, 'CREATE', 'PaiementEleve', 'bulk', {
    count: created.length, type: data.type, montant: String(data.montant),
  });
  return { count: created.length, paiements: created };
}

export async function modifierPaiementEleve(id: string, etablissement_id: string, data: UpdatePaiementEleveInput, acteurId: string) {
  const existing = await prisma.paiementEleve.findFirst({
    where: { id, eleve: { etablissement_id } },
  });
  if (!existing) throw new NotFoundError('Paiement introuvable');

  const paiement = await prisma.paiementEleve.update({
    where: { id },
    data: {
      ...(data.type !== undefined && { type: data.type }),
      ...(data.montant !== undefined && { montant: data.montant }),
      ...(data.mois !== undefined && { mois: data.mois }),
      ...(data.annee !== undefined && { annee: data.annee }),
      ...(data.statut !== undefined && { statut: data.statut }),
    },
    include: { eleve: { select: { id: true, nom_fr: true, matricule: true } } },
  });
  await logAction(etablissement_id, acteurId, 'UPDATE', 'PaiementEleve', id, { changes: data });
  return paiement;
}

export async function supprimerPaiementEleve(id: string, etablissement_id: string, acteurId: string) {
  const existing = await prisma.paiementEleve.findFirst({
    where: { id, eleve: { etablissement_id } },
  });
  if (!existing) throw new NotFoundError('Paiement introuvable');
  await prisma.paiementEleve.delete({ where: { id } });
  await logAction(etablissement_id, acteurId, 'DELETE', 'PaiementEleve', id, {
    eleve_id: existing.eleve_id, montant: String(existing.montant), recu: existing.recu_numero,
  });
}

export async function listerPaiementsPersonnel(
  etablissement_id: string,
  page = 1,
  mois?: number,
  annee?: number
) {
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    personnel: { utilisateur: { etablissement_id } },
  };

  if (mois) where.mois = mois;
  if (annee) where.annee = annee;

  const [total, items] = await Promise.all([
    prisma.paiementPersonnel.count({ where }),
    prisma.paiementPersonnel.findMany({
      where,
      skip,
      take: limit,
      include: {
        personnel: {
          include: {
            utilisateur: { select: { nom_fr: true } },
          },
        },
      },
      orderBy: [{ annee: 'desc' }, { mois: 'desc' }],
    }),
  ]);

  return { total, page, limit, data: items };
}

export async function creerPaiementPersonnel(etablissement_id: string, data: PaiementPersonnelInput, acteurId: string) {
  const personnel = await prisma.personnel.findFirst({
    where: { id: data.personnel_id, utilisateur: { etablissement_id } },
  });
  if (!personnel) throw new NotFoundError('Personnel introuvable');

  const paiement = await prisma.paiementPersonnel.create({
    data: {
      personnel_id: data.personnel_id,
      mois: data.mois,
      annee: data.annee,
      montant_brut: data.montant_brut,
      retenues: data.retenues ?? 0,
      net_a_payer: data.net_a_payer,
      heures_theoriques: data.heures_theoriques,
      heures_reelles: data.heures_reelles,
    },
  });
  await logAction(etablissement_id, acteurId, 'CREATE', 'PaiementPersonnel', paiement.id, {
    personnel_id: data.personnel_id, mois: data.mois, annee: data.annee, net: String(data.net_a_payer),
  });
  return paiement;
}

export async function getStatsMensuels(etablissement_id: string, nbMois = 6) {
  const now = new Date();
  const MOIS_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

  // Construire la liste des (mois, annee) couverts
  const periodes: { mois: number; annee: number }[] = [];
  for (let i = nbMois - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periodes.push({ mois: d.getMonth() + 1, annee: d.getFullYear() });
  }

  // Une seule requête groupée au lieu de N requêtes séquentielles
  const annees = [...new Set(periodes.map(p => p.annee))];
  const rows = await prisma.paiementEleve.groupBy({
    by: ['mois', 'annee'],
    where: {
      eleve: { etablissement_id },
      annee: { in: annees },
    },
    _sum: { montant: true },
  });

  const totauxMap = new Map(rows.map(r => [`${r.mois}-${r.annee}`, Number(r._sum.montant ?? 0)]));

  return periodes.map(({ mois, annee }) => ({
    label: `${MOIS_LABELS[mois - 1]} ${annee}`,
    mois,
    annee,
    total: totauxMap.get(`${mois}-${annee}`) ?? 0,
  }));
}

export async function getStatsFinances(etablissement_id: string) {
  const now = new Date();
  const moisCourant = now.getMonth() + 1;
  const anneeCourante = now.getFullYear();

  const [totalEncaisse, nbPaiements, totalProfesseurs] = await Promise.all([
    prisma.paiementEleve.aggregate({
      where: {
        eleve: { etablissement_id },
        mois: moisCourant,
        annee: anneeCourante,
      },
      _sum: { montant: true },
      _count: true,
    }),
    prisma.paiementEleve.count({
      where: {
        eleve: { etablissement_id },
        mois: moisCourant,
        annee: anneeCourante,
      },
    }),
    prisma.paiementPersonnel.aggregate({
      where: {
        personnel: { utilisateur: { etablissement_id } },
        mois: moisCourant,
        annee: anneeCourante,
      },
      _sum: { net_a_payer: true },
    }),
  ]);

  return {
    mois: moisCourant,
    annee: anneeCourante,
    // Number() obligatoire : _sum d'un Decimal Prisma est sérialisé en string dans le
    // JSON (le type annoncé est number). Sans conversion, tout calcul futur concaténerait.
    total_encaisse_eleves: Number(totalEncaisse._sum.montant ?? 0),
    nb_paiements_eleves: nbPaiements,
    total_paye_professeurs: Number(totalProfesseurs._sum.net_a_payer ?? 0),
  };
}

export async function getReliquats(
  etablissement_id: string,
  annee_scolaire_id?: string,
  filtreMois?: number,
  filtreAnnee?: number,
) {
  const now = new Date();
  const anneeActuelle = now.getFullYear();
  const moisActuel = now.getMonth() + 1;

  let moisScolaireAnnee: { mois: number; annee: number }[];

  if (filtreMois && filtreAnnee) {
    // Vue d'un seul mois précis
    moisScolaireAnnee = [{ mois: filtreMois, annee: filtreAnnee }];
  } else {
    // Tous les mois scolaires de septembre à aujourd'hui
    const moisScolaires: number[] = [];
    for (let m = 9; m <= 12; m++) moisScolaires.push(m);
    for (let m = 1; m <= moisActuel; m++) moisScolaires.push(m);
    moisScolaireAnnee = moisScolaires.map(m => ({ mois: m, annee: m >= 9 ? anneeActuelle - 1 : anneeActuelle }));
  }

  const anneesUtilisees = [...new Set(moisScolaireAnnee.map(m => m.annee))];

  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  const montantMensualite = Number(config?.montant_mensualite ?? 7500);

  const inscriptions = await prisma.inscription.findMany({
    where: {
      statut: 'actif',
      ...(annee_scolaire_id ? { annee_scolaire_id } : {}),
      eleve: { etablissement_id },
    },
    include: {
      eleve: {
        select: {
          id: true,
          nom_fr: true,
          prenom_fr: true,
          matricule: true,
          paiements: { where: { type: 'mensualite', annee: { in: anneesUtilisees } } },
        },
      },
    },
  });

  return inscriptions
    .map(insc => {
      const payes = insc.eleve.paiements.map(p => `${p.mois}-${p.annee}`);
      const manquants = moisScolaireAnnee.filter(({ mois, annee }) => !payes.includes(`${mois}-${annee}`));
      return {
        eleve: { id: insc.eleve.id, nom_fr: insc.eleve.nom_fr, prenom_fr: insc.eleve.prenom_fr, matricule: insc.eleve.matricule },
        nb_mois_dus: manquants.length,
        mois_manquants: manquants,
        montant_du: manquants.length * montantMensualite,
      };
    })
    .filter(r => r.nb_mois_dus > 0)
    .sort((a, b) => b.nb_mois_dus - a.nb_mois_dus);
}
