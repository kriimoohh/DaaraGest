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
    total_encaisse_eleves: totalEncaisse._sum.montant ?? 0,
    nb_paiements_eleves: nbPaiements,
    total_paye_professeurs: totalProfesseurs._sum.net_a_payer ?? 0,
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
