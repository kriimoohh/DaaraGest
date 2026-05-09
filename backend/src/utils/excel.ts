import ExcelJS from 'exceljs';

export async function exportElevesExcel(eleves: Array<{
  matricule: string;
  nom_fr: string;
  prenom_fr: string;
  sexe: string;
  date_naissance: Date | string;
  actif: boolean;
  inscriptions?: Array<{ annee_scolaire?: { libelle: string }; classe_fr?: { nom_fr: string } | null; classe_ar?: { nom_fr: string } | null }>;
}>, etablissementNom = ''): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = etablissementNom || 'DaaraGest';
  const ws = wb.addWorksheet('Élèves');

  ws.columns = [
    { header: 'Matricule',       key: 'matricule',      width: 16 },
    { header: 'Nom',             key: 'nom_fr',         width: 20 },
    { header: 'Prénom',          key: 'prenom_fr',      width: 20 },
    { header: 'Sexe',            key: 'sexe',           width: 10 },
    { header: 'Date naissance',  key: 'date_naissance', width: 18 },
    { header: 'Classe FR',       key: 'classe_fr',      width: 16 },
    { header: 'Classe AR',       key: 'classe_ar',      width: 16 },
    { header: 'Année scolaire',  key: 'annee',          width: 16 },
    { header: 'Statut',          key: 'actif',          width: 12 },
  ];

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  for (const e of eleves) {
    const insc = e.inscriptions?.[0];
    ws.addRow({
      matricule: e.matricule,
      nom_fr: e.nom_fr,
      prenom_fr: e.prenom_fr,
      sexe: e.sexe === 'M' ? 'Masculin' : 'Féminin',
      date_naissance: new Date(e.date_naissance).toLocaleDateString('fr-FR'),
      classe_fr: insc?.classe_fr?.nom_fr ?? '—',
      classe_ar: insc?.classe_ar?.nom_fr ?? '—',
      annee: insc?.annee_scolaire?.libelle ?? '—',
      actif: e.actif ? 'Actif' : 'Inactif',
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function exportNotesExcel(data: {
  classe: string;
  matiere: string;
  annee: string;
  periode: number;
  notes: Array<{ matricule: string; nom_fr: string; prenom_fr: string; valeur: number | null }>;
  etablissementNom?: string;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = data.etablissementNom || 'DaaraGest';
  const ws = wb.addWorksheet(`Notes T${data.periode}`);

  ws.addRow([`Classe : ${data.classe}`, '', `Matière : ${data.matiere}`, '', `Année : ${data.annee}`, `Période : T${data.periode}`]);
  ws.addRow([]);

  ws.columns = [
    { header: 'Matricule', key: 'matricule',  width: 16 },
    { header: 'Nom',       key: 'nom_fr',     width: 22 },
    { header: 'Prénom',    key: 'prenom_fr',  width: 22 },
    { header: 'Note',      key: 'valeur',     width: 10 },
  ];

  ws.getRow(3).font = { bold: true };
  ws.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
  ws.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  for (const n of data.notes) {
    ws.addRow({
      matricule: n.matricule,
      nom_fr: n.nom_fr,
      prenom_fr: n.prenom_fr,
      valeur: n.valeur ?? '',
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function exportFinancesExcel(paiements: Array<{
  recu_numero: string | null;
  eleve?: { nom_fr: string; prenom_fr: string; matricule: string } | null;
  type: string;
  montant: { toNumber?: () => number } | number | string;
  statut: string;
  mois: number | null;
  annee: number | null;
  created_at: Date | string;
}>, etablissementNom = ''): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = etablissementNom || 'DaaraGest';
  const ws = wb.addWorksheet('Paiements');

  ws.columns = [
    { header: 'N° Reçu',         key: 'recu',       width: 22 },
    { header: 'Élève',           key: 'eleve',      width: 28 },
    { header: 'Matricule',       key: 'matricule',  width: 16 },
    { header: 'Type',            key: 'type',       width: 18 },
    { header: 'Montant (FCFA)',  key: 'montant',    width: 16 },
    { header: 'Statut',          key: 'statut',     width: 12 },
    { header: 'Mois',            key: 'mois',       width: 8 },
    { header: 'Année',           key: 'annee',      width: 8 },
    { header: 'Date',            key: 'date',       width: 18 },
  ];

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  for (const p of paiements) {
    ws.addRow({
      recu: p.recu_numero ?? '—',
      eleve: p.eleve ? `${p.eleve.prenom_fr} ${p.eleve.nom_fr}` : '—',
      matricule: p.eleve?.matricule ?? '—',
      type: p.type,
      montant: typeof p.montant === 'object' && p.montant && 'toNumber' in p.montant ? p.montant.toNumber!() : Number(p.montant),
      statut: p.statut === 'paye' ? 'Payé' : 'Non payé',
      mois: p.mois ?? '—',
      annee: p.annee ?? '—',
      date: new Date(p.created_at).toLocaleDateString('fr-FR'),
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
