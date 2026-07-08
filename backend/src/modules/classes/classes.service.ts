import prisma from '../../config/database';
import { ClasseInput, ClasseMatiereInput, ClasseMatiereUpdateInput, ClasseMatierePeriodeInput, DupliquerArInput } from './classes.schema';
import { renderPdfHtml } from '../../utils/browserPool';
import { DEFAULT_NOTE_MAX } from '../../utils/notes';
import { bulletinsImpactesParMatiere } from '../bulletins/bulletins.service';
import { logAction } from '../../utils/audit';
import { NotFoundError } from '../../utils/errors';
import { classeCode } from '../../utils/classeCode';

// Erreur typée pour exposer le détail de l'impact (front affiche les options).
function bulletinsImpactError(payload: unknown): Error {
  const err = new Error('Bulletins déjà générés impactés');
  (err as { statusCode?: number; payload?: unknown }).statusCode = 409;
  (err as { statusCode?: number; payload?: unknown }).payload = payload;
  return err;
}

type ListeData = Awaited<ReturnType<typeof listerElevesDeClasse>>;

const LISTE_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; }
  .header { text-align: center; margin-bottom: 18px; border-bottom: 2px solid #10B981; padding-bottom: 12px; }
  .header h1 { font-size: 18px; font-weight: 700; color: #10B981; letter-spacing: 0.5px; }
  .header h2 { font-size: 14px; font-weight: 600; margin-top: 4px; }
  .meta { display: flex; justify-content: space-between; font-size: 10px; color: #555; margin-top: 6px; }
  .badge { display: inline-block; padding: 1px 8px; border-radius: 99px; font-size: 10px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  thead tr { background: #10B981; color: white; }
  thead th { padding: 7px 6px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
  tbody tr:nth-child(even) { background: #f0fdf4; }
  td { padding: 5px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
  td:first-child { text-align: center; color: #6b7280; font-size: 10px; font-weight: 600; }
  .mono { font-family: monospace; font-size: 10px; color: #374151; }
  .center { text-align: center; }
  .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
  .signature { margin-top: 40px; display: flex; justify-content: flex-end; }
  .signature-box { text-align: center; font-size: 10px; color: #374151; }
  .signature-line { border-top: 1px solid #374151; width: 160px; margin: 30px auto 4px; }
  @page { size: A4; margin: 0; }
`;

export async function listerClasses(etablissement_id: string, annee_scolaire_id?: string, filiere?: string) {
  const classes = await prisma.classe.findMany({
    where: {
      etablissement_id,
      active: true,
      ...(annee_scolaire_id ? { annee_scolaire_id } : {}),
      ...(filiere === 'FR' || filiere === 'AR' ? { filiere } : {}),
    },
    include: {
      annee_scolaire: true,
      niveau: true,
      _count: {
        select: {
          inscriptions_fr: { where: { statut: 'actif' } },
          inscriptions_ar: { where: { statut: 'actif' } },
        },
      },
    },
    orderBy: [{ filiere: 'asc' }, { niveau: { ordre: 'asc' } }, { nom_fr: 'asc' }],
  });

  return classes.map(({ _count, ...c }) => ({
    ...c,
    effectif: c.filiere === 'FR' ? _count.inscriptions_fr : _count.inscriptions_ar,
  }));
}

export async function getClasse(id: string, etablissement_id: string) {
  const classe = await prisma.classe.findFirst({
    where: { id, etablissement_id },
    include: { annee_scolaire: true, niveau: true },
  });
  if (!classe) throw new NotFoundError('Classe introuvable');
  return classe;
}

export async function creerClasse(etablissement_id: string, data: ClasseInput) {
  return prisma.classe.create({
    data: {
      etablissement_id,
      nom_fr: data.nom_fr,
      nom_ar: data.nom_ar ?? null,
      filiere: data.filiere,
      niveau_id: data.niveau_id ?? null,
      annee_scolaire_id: data.annee_scolaire_id,
      capacite: data.capacite ?? 30,
      code: classeCode(data.nom_fr, data.filiere),
    },
  });
}

export async function modifierClasse(id: string, etablissement_id: string, data: ClasseInput) {
  const existing = await prisma.classe.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new NotFoundError('Classe introuvable');

  return prisma.classe.update({
    where: { id },
    data: {
      nom_fr: data.nom_fr,
      nom_ar: data.nom_ar ?? null,
      filiere: data.filiere,
      niveau_id: data.niveau_id ?? null,
      annee_scolaire_id: data.annee_scolaire_id,
      capacite: data.capacite,
      code: classeCode(data.nom_fr, data.filiere),
    },
  });
}

export async function supprimerClasse(id: string, etablissement_id: string) {
  const existing = await prisma.classe.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new NotFoundError('Classe introuvable');

  return prisma.classe.update({ where: { id }, data: { active: false } });
}

// ─── Programme de matières par classe ───────────────────────────────────────

export async function listerMatieresDeclasse(classe_id: string, etablissement_id: string) {
  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new NotFoundError('Classe introuvable');

  // Barème effectif = override de classe si présent, sinon échelle établissement.
  // Exposé sur la matière (note_max) ET au niveau du lien (note_max_effectif) pour
  // la saisie/affichage des notes, qui doivent utiliser ce barème, pas un défaut plat.
  const config = await prisma.configNotes.findUnique({
    where: { etablissement_id }, select: { note_max: true },
  });
  const baseNote = Number(config?.note_max ?? DEFAULT_NOTE_MAX);

  const rows = await prisma.classeMatiere.findMany({
    where: { classe_id },
    include: { matiere: true },
    orderBy: [{ ordre_override: 'asc' }, { matiere: { ordre_bulletin: 'asc' } }],
  });
  // Overrides par période (coeff/note_max/evaluee) — utiles pour l'UI Programme afin
  // d'afficher la matrice "matière × trimestre" et les badges "non évaluée au T1".
  const periodesOv = await prisma.classeMatierePeriode.findMany({ where: { classe_id } });
  const ovByMatiere = new Map<string, typeof periodesOv>();
  for (const o of periodesOv) {
    if (!ovByMatiere.has(o.matiere_id)) ovByMatiere.set(o.matiere_id, []);
    ovByMatiere.get(o.matiere_id)!.push(o);
  }
  return rows.map(r => {
    const note_max_effectif = Number(r.note_max_override ?? baseNote);
    return {
      ...r,
      note_max_effectif,
      matiere: { ...r.matiere, note_max: note_max_effectif },
      periodes_override: (ovByMatiere.get(r.matiere_id) ?? []).map(o => ({
        periode: o.periode, coeff: Number(o.coeff), note_max: Number(o.note_max), evaluee: o.evaluee,
      })),
    };
  });
}

export async function ajouterMatiereClasse(
  classe_id: string, etablissement_id: string, data: ClasseMatiereInput
) {
  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new NotFoundError('Classe introuvable');

  const matiere = await prisma.matiere.findFirst({
    where: { id: data.matiere_id, etablissement_id, active: true },
  });
  if (!matiere) throw new NotFoundError('Matière introuvable');
  if (matiere.filiere !== classe.filiere) {
    throw new Error(`Impossible d'ajouter une matière ${matiere.filiere} à une classe ${classe.filiere}`);
  }

  return prisma.classeMatiere.create({
    data: {
      classe_id,
      matiere_id: data.matiere_id,
      coeff_override: data.coeff_override ?? null,
      ordre_override: data.ordre_override ?? null,
      evaluee: data.evaluee ?? true,
    },
    include: { matiere: true },
  });
}

export async function modifierMatiereClasse(
  classe_id: string, etablissement_id: string, matiere_id: string, data: ClasseMatiereUpdateInput,
  opts: { force?: boolean; acteur_id?: string } = {},
) {
  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new NotFoundError('Classe introuvable');

  const existing = await prisma.classeMatiere.findUnique({
    where: { classe_id_matiere_id: { classe_id, matiere_id } },
  });
  if (!existing) throw new Error('Matière non assignée à cette classe');

  // Vérif impact uniquement si `evaluee` change réellement (autres champs n'invalident pas les bulletins).
  const evalueeChange = data.evaluee !== undefined && data.evaluee !== existing.evaluee;
  if (evalueeChange) {
    const config = await prisma.configNotes.findUnique({ where: { etablissement_id }, select: { nb_periodes: true } });
    const nbPeriodes = config?.nb_periodes ?? 3;
    const periodesAll = [...Array.from({ length: nbPeriodes }, (_, i) => i + 1), 0]; // trimestres + annuel
    const impact = await bulletinsImpactesParMatiere(classe_id, matiere_id, periodesAll);
    if (impact.signed.length > 0) {
      // Verrouillage strict : un bulletin signé doit être explicitement déverrouillé.
      throw bulletinsImpactError({
        code: 'BULLETINS_VALIDES',
        signed_count: impact.signed.length,
        unsigned_count: impact.unsigned.length,
        signed: impact.signed,
        unsigned: impact.unsigned,
      });
    }
    if (impact.unsigned.length > 0 && !opts.force) {
      throw bulletinsImpactError({
        code: 'BULLETINS_IMPACTES',
        unsigned_count: impact.unsigned.length,
        unsigned: impact.unsigned,
      });
    }
  }

  // Patch partiel : seuls les champs fournis sont modifiés. `evaluee` n'a pas de
  // sentinelle "null = unset" (toujours bool), donc on ne touche au champ que si présent.
  const updateData: Record<string, unknown> = {
    coeff_override: data.coeff_override ?? null,
    ordre_override: data.ordre_override ?? null,
  };
  if (data.evaluee !== undefined) updateData.evaluee = data.evaluee;
  const updated = await prisma.classeMatiere.update({
    where: { classe_id_matiere_id: { classe_id, matiere_id } },
    data: updateData,
    include: { matiere: true },
  });

  if (evalueeChange && opts.acteur_id) {
    await logAction(etablissement_id, opts.acteur_id, 'UPDATE', 'ClasseMatiere', updated.id, {
      action: 'toggle_evaluee', classe_id, matiere_id,
      ancien: existing.evaluee, nouveau: data.evaluee, force: !!opts.force,
    });
  }
  return updated;
}

// ─── Overrides par période (coeff/note_max/evaluee) ──────────────────────────

/**
 * Upsert d'un override par période. Utilisé par la modale Programme pour piloter
 * la matrice "matière × trimestre". Si l'override existant a des valeurs et que
 * l'input n'en redéfinit pas, on les conserve (patch partiel).
 */
export async function upsertOverridePeriode(
  classe_id: string, etablissement_id: string, data: ClasseMatierePeriodeInput,
  opts: { force?: boolean; acteur_id?: string } = {},
) {
  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new Error('Classe introuvable');

  // Charger pour récupérer les valeurs effectives par défaut (coeff/note_max) à
  // utiliser si l'override n'en redéfinit pas (le modèle n'admet pas de null).
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id }, select: { note_max: true } });
  const baseNote = Number(config?.note_max ?? DEFAULT_NOTE_MAX);
  const cm = await prisma.classeMatiere.findUnique({
    where: { classe_id_matiere_id: { classe_id, matiere_id: data.matiere_id } },
    include: { matiere: true },
  });
  if (!cm) throw new Error('Matière non assignée à cette classe');

  const existing = await prisma.classeMatierePeriode.findUnique({
    where: { classe_id_matiere_id_periode: { classe_id, matiere_id: data.matiere_id, periode: data.periode } },
  });

  // Vérif impact si `evaluee` change réellement (= effectivement va modifier la moyenne T+annuel).
  const ancienEvaluee = existing?.evaluee ?? cm.evaluee;
  const nouveauEvaluee = data.evaluee !== undefined ? (data.evaluee ?? cm.evaluee) : ancienEvaluee;
  const evalueeChange = data.evaluee !== undefined && ancienEvaluee !== nouveauEvaluee;
  if (evalueeChange) {
    const impact = await bulletinsImpactesParMatiere(classe_id, data.matiere_id, [data.periode, 0]);
    if (impact.signed.length > 0) {
      throw bulletinsImpactError({
        code: 'BULLETINS_VALIDES',
        signed_count: impact.signed.length,
        unsigned_count: impact.unsigned.length,
        signed: impact.signed, unsigned: impact.unsigned,
      });
    }
    if (impact.unsigned.length > 0 && !opts.force) {
      throw bulletinsImpactError({
        code: 'BULLETINS_IMPACTES',
        unsigned_count: impact.unsigned.length, unsigned: impact.unsigned,
      });
    }
  }

  const coeff = data.coeff ?? Number(existing?.coeff ?? cm.coeff_override ?? cm.matiere.coeff_defaut);
  const note_max = data.note_max ?? Number(existing?.note_max ?? cm.note_max_override ?? baseNote);
  // evaluee: si non fourni, on garde l'existant (ou null si pas d'override).
  const evaluee = data.evaluee !== undefined ? data.evaluee : (existing?.evaluee ?? null);

  const result = await prisma.classeMatierePeriode.upsert({
    where: { classe_id_matiere_id_periode: { classe_id, matiere_id: data.matiere_id, periode: data.periode } },
    create: { classe_id, matiere_id: data.matiere_id, periode: data.periode, coeff, note_max, evaluee },
    update: { coeff, note_max, evaluee },
  });

  if (evalueeChange && opts.acteur_id) {
    await logAction(etablissement_id, opts.acteur_id, 'UPDATE', 'ClasseMatierePeriode', result.id, {
      action: 'toggle_evaluee_periode', classe_id, matiere_id: data.matiere_id, periode: data.periode,
      ancien: ancienEvaluee, nouveau: nouveauEvaluee, force: !!opts.force,
    });
  }
  return result;
}

export async function supprimerOverridePeriode(
  classe_id: string, etablissement_id: string, matiere_id: string, periode: number,
  opts: { force?: boolean; acteur_id?: string } = {},
) {
  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new Error('Classe introuvable');
  // Si l'override existant porte un evaluee non null et que le défaut classe diffère,
  // la suppression équivaut à un changement d'évaluée → vérif d'impact.
  const existing = await prisma.classeMatierePeriode.findUnique({
    where: { classe_id_matiere_id_periode: { classe_id, matiere_id, periode } },
  });
  if (existing && existing.evaluee !== null) {
    const cm = await prisma.classeMatiere.findUnique({
      where: { classe_id_matiere_id: { classe_id, matiere_id } },
      select: { evaluee: true },
    });
    const evalueeChange = cm && cm.evaluee !== existing.evaluee;
    if (evalueeChange) {
      const impact = await bulletinsImpactesParMatiere(classe_id, matiere_id, [periode, 0]);
      if (impact.signed.length > 0) {
        throw bulletinsImpactError({
          code: 'BULLETINS_VALIDES',
          signed_count: impact.signed.length, unsigned_count: impact.unsigned.length,
          signed: impact.signed, unsigned: impact.unsigned,
        });
      }
      if (impact.unsigned.length > 0 && !opts.force) {
        throw bulletinsImpactError({
          code: 'BULLETINS_IMPACTES',
          unsigned_count: impact.unsigned.length, unsigned: impact.unsigned,
        });
      }
    }
  }
  await prisma.classeMatierePeriode.deleteMany({ where: { classe_id, matiere_id, periode } });
  if (existing && opts.acteur_id) {
    await logAction(etablissement_id, opts.acteur_id, 'DELETE', 'ClasseMatierePeriode', existing.id, {
      action: 'reset_override_periode', classe_id, matiere_id, periode,
    });
  }
}

export async function supprimerMatiereClasse(
  classe_id: string, etablissement_id: string, matiere_id: string
) {
  const classe = await prisma.classe.findFirst({ where: { id: classe_id, etablissement_id } });
  if (!classe) throw new NotFoundError('Classe introuvable');

  const existing = await prisma.classeMatiere.findUnique({
    where: { classe_id_matiere_id: { classe_id, matiere_id } },
  });
  if (!existing) throw new Error('Matière non assignée à cette classe');

  return prisma.classeMatiere.delete({
    where: { classe_id_matiere_id: { classe_id, matiere_id } },
  });
}

export async function listerElevesDeClasse(
  classe_id: string,
  etablissement_id: string,
  annee_scolaire_id?: string
) {
  const classe = await prisma.classe.findFirst({
    where: { id: classe_id, etablissement_id },
    include: { annee_scolaire: true },
  });
  if (!classe) throw new NotFoundError('Classe introuvable');

  const inscriptions = await prisma.inscription.findMany({
    where: {
      OR: [{ classe_fr_id: classe_id }, { classe_ar_id: classe_id }],
      ...(annee_scolaire_id ? { annee_scolaire_id } : { annee_scolaire_id: classe.annee_scolaire_id }),
      eleve: { etablissement_id, actif: true },
    },
    include: {
      eleve: { include: { parents: true } },
      annee_scolaire: true,
      classe_fr: true,
      classe_ar: true,
    },
    orderBy: [{ eleve: { nom_fr: 'asc' } }, { eleve: { prenom_fr: 'asc' } }],
  });

  return {
    classe,
    total: inscriptions.length,
    eleves: inscriptions.map((i, idx) => ({
      rang: idx + 1,
      ...i.eleve,
      annee_scolaire: i.annee_scolaire,
      classe_fr: i.classe_fr,
      classe_ar: i.classe_ar,
    })),
  };
}

// ─── Duplication FR → AR ─────────────────────────────────────────────────────

export async function dupliquerClasseFrEnAr(
  id: string,
  etablissement_id: string,
  data: DupliquerArInput
) {
  const source = await prisma.classe.findFirst({
    where: { id, etablissement_id, active: true },
    include: { annee_scolaire: true, niveau: true },
  });
  if (!source) throw new NotFoundError('Classe introuvable');
  if (source.filiere !== 'FR') throw new Error('La classe source doit être de filière française (FR)');

  const whereInscriptions = {
    classe_fr_id: id,
    annee_scolaire_id: source.annee_scolaire_id,
    statut: 'actif',
  };

  return prisma.$transaction(async (tx) => {
    const nomAr = data.nom_fr ?? `${source.nom_fr} (AR)`;

    const nouvelleClasse = await tx.classe.create({
      data: {
        etablissement_id,
        annee_scolaire_id: source.annee_scolaire_id,
        nom_fr: nomAr,
        filiere: 'AR',
        niveau_id: source.niveau_id ?? null,
        capacite: source.capacite,
        code: classeCode(nomAr, 'AR'),
      },
      include: { annee_scolaire: true, niveau: true },
    });

    const updated = await tx.inscription.updateMany({
      where: { ...whereInscriptions, classe_ar_id: null },
      data: { classe_ar_id: nouvelleClasse.id },
    });

    const total = await tx.inscription.count({ where: whereInscriptions });

    return {
      classe: nouvelleClasse,
      stats: {
        total_eleves_source: total,
        eleves_inscrits: updated.count,
        eleves_ignores: total - updated.count,
      },
    };
  }, { timeout: 15000 });
}

// ─── PDF liste élèves ────────────────────────────────────────────────────────

function buildListeBodyContent(data: ListeData, etablissementNom: string): string {
  const { classe, eleves, total } = data;
  const anneeLabel = (classe.annee_scolaire as { libelle: string })?.libelle ?? '';
  const filiereLabel = classe.filiere === 'FR' ? 'Filière Française' : 'Filière Arabe';
  const dateImpression = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const nbM = eleves.filter((e: { sexe: string }) => e.sexe === 'M').length;
  const nbF = total - nbM;
  const badgeBg = classe.filiere === 'FR' ? '#dbeafe' : '#d1fae5';
  const badgeColor = classe.filiere === 'FR' ? '#1e40af' : '#065f46';

  const rows = eleves.map((e: {
    matricule: string; nom_fr: string; prenom_fr: string; sexe: string;
    date_naissance: Date | null; parents?: { nom_fr: string; telephone: string }[];
  }, idx: number) => `
    <tr>
      <td>${idx + 1}</td>
      <td class="mono">${e.matricule}</td>
      <td>${e.nom_fr}</td>
      <td>${e.prenom_fr}</td>
      <td class="center">${e.sexe === 'M' ? 'M' : 'F'}</td>
      <td>${e.date_naissance ? new Date(e.date_naissance).toLocaleDateString('fr-FR') : '—'}</td>
      <td>${e.parents?.[0]?.nom_fr ?? '—'}</td>
      <td class="mono">${e.parents?.[0]?.telephone ?? '—'}</td>
    </tr>`).join('');

  return `
  <div class="header">
    <h1>${etablissementNom}</h1>
    <h2>Liste des élèves — ${classe.nom_fr}</h2>
    <div class="meta">
      <span>Année scolaire : <strong>${anneeLabel}</strong></span>
      <span class="badge" style="background:${badgeBg};color:${badgeColor}">${filiereLabel}</span>
      <span>Niveau : <strong>${(classe as { niveau?: { libelle: string } | null }).niveau?.libelle || '—'}</strong></span>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:32px">N°</th>
        <th>Matricule</th>
        <th>Nom</th>
        <th>Prénom</th>
        <th style="width:36px">Sexe</th>
        <th>Date de naissance</th>
        <th>Parent / Tuteur</th>
        <th>Téléphone</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">
    <span>Total : <strong>${total} élève${total > 1 ? 's' : ''}</strong> &nbsp;·&nbsp; Garçons : <strong>${nbM}</strong> &nbsp;·&nbsp; Filles : <strong>${nbF}</strong></span>
    <span>Imprimé le ${dateImpression}</span>
  </div>
  <div class="signature">
    <div class="signature-box">
      <div class="signature-line"></div>
      Signature du responsable
    </div>
  </div>`;
}

function buildSingleListeHtml(data: ListeData, etablissementNom: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Liste ${data.classe.nom_fr}</title>
  <style>${LISTE_CSS} body { padding: 15mm; }</style>
</head>
<body>${buildListeBodyContent(data, etablissementNom)}</body>
</html>`;
}

function buildCombinedListeHtml(dataList: ListeData[], etablissementNom: string): string {
  const pages = dataList.map((data, i) =>
    `<div class="${i < dataList.length - 1 ? 'page pb' : 'page'}">${buildListeBodyContent(data, etablissementNom)}</div>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Toutes les classes</title>
  <style>
    ${LISTE_CSS}
    .page { padding: 15mm; }
    .pb { page-break-after: always; }
  </style>
</head>
<body>${pages}</body>
</html>`;
}

function renderPdf(html: string): Promise<Buffer> {
  return renderPdfHtml(html, { format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
}

export async function genererPdfListeClasse(
  classe_id: string,
  etablissement_id: string,
  annee_scolaire_id?: string
): Promise<Buffer> {
  const etab = await prisma.etablissement.findUnique({ where: { id: etablissement_id }, select: { nom_fr: true } });
  const etablissementNom = etab?.nom_fr ?? '';
  const data = await listerElevesDeClasse(classe_id, etablissement_id, annee_scolaire_id);
  return renderPdf(buildSingleListeHtml(data, etablissementNom));
}

export async function genererPdfToutesClasses(
  etablissement_id: string,
  annee_scolaire_id?: string
): Promise<Buffer> {
  const etab = await prisma.etablissement.findUnique({ where: { id: etablissement_id }, select: { nom_fr: true } });
  const etablissementNom = etab?.nom_fr ?? '';

  const classes = await listerClasses(etablissement_id, annee_scolaire_id);
  if (classes.length === 0) throw new Error('Aucune classe trouvée');

  const dataList: ListeData[] = [];
  for (const classe of classes) {
    try {
      const data = await listerElevesDeClasse(classe.id, etablissement_id, annee_scolaire_id);
      if (data.eleves.length > 0) dataList.push(data);
    } catch { /* ignore */ }
  }
  if (dataList.length === 0) throw new Error('Aucun élève trouvé dans les classes');

  return renderPdf(buildCombinedListeHtml(dataList, etablissementNom));
}
