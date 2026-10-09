import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import { logAction } from '../../utils/audit';
import { ValidationError, NotFoundError } from '../../utils/errors';
import { ReconduireClassesInput } from './classes.schema';

export type StatutReconduction = 'a_creer' | 'creee' | 'existe';

export interface LigneReconduction {
  classe_source_id: string;
  nom_fr: string;
  filiere: string;
  niveau: string | null;
  nb_matieres: number;
  statut: StatutReconduction;
}

/**
 * Reconduit les classes actives d'une année vers une autre (toutes ou une sélection).
 *
 * Reprend la STRUCTURE (nom, filière, niveau, capacité, mode de programme, code stable)
 * et, si `matieres === 'copier'`, le PROGRAMME (ClasseMatiere + overrides par période).
 * Ne reprend JAMAIS : affectations enseignants, emploi du temps, élèves/inscriptions,
 * notes, cahier de texte — l'équipe et les effectifs changent d'une année à l'autre.
 *
 * Idempotent : une classe de même (filière + nom) déjà présente dans l'année cible est
 * signalée `existe` et ignorée (aucun écrasement). Écritures en createMany (pas de boucle
 * en $transaction : timeout Prisma à 5 s).
 */
export async function reconduireClasses(etablissement_id: string, data: ReconduireClassesInput, acteurId: string) {
  if (data.annee_source_id === data.annee_cible_id) {
    throw new ValidationError("L'année source et l'année cible doivent être différentes");
  }
  const annees = await prisma.anneeScolaire.findMany({
    where: { etablissement_id, id: { in: [data.annee_source_id, data.annee_cible_id] } },
    select: { id: true },
  });
  if (annees.length !== 2) throw new NotFoundError('Année scolaire introuvable');

  const sources = await prisma.classe.findMany({
    where: {
      etablissement_id, annee_scolaire_id: data.annee_source_id, active: true,
      ...(data.classe_ids ? { id: { in: data.classe_ids } } : {}),
    },
    include: { filiere_ref: { select: { code: true } }, niveau: { select: { libelle: true } }, _count: { select: { classe_matieres: true } } },
    orderBy: [{ niveau: { ordre: 'asc' } }, { nom_fr: 'asc' }],
  });
  if (data.classe_ids && sources.length !== data.classe_ids.length) {
    throw new ValidationError("Certaines classes sélectionnées n'appartiennent pas à l'année source");
  }

  const existantes = await prisma.classe.findMany({
    where: { etablissement_id, annee_scolaire_id: data.annee_cible_id },
    select: { filiere_id: true, nom_fr: true },
  });
  const cle = (filiere_id: string, nom_fr: string) => `${filiere_id}|${nom_fr.trim().toLowerCase()}`;
  const dejaLa = new Set(existantes.map(c => cle(c.filiere_id, c.nom_fr)));

  const aCreer = sources.filter(s => !dejaLa.has(cle(s.filiere_id, s.nom_fr)));
  const nouveauId = new Map(aCreer.map(s => [s.id, randomUUID()]));

  if (!data.apercu && aCreer.length > 0) {
    const ids = aCreer.map(s => s.id);
    const [liens, periodes] = data.matieres === 'copier'
      ? await Promise.all([
          prisma.classeMatiere.findMany({ where: { classe_id: { in: ids } } }),
          prisma.classeMatierePeriode.findMany({ where: { classe_id: { in: ids } } }),
        ])
      : [[], []];

    await prisma.$transaction(async (tx) => {
      await tx.classe.createMany({
        data: aCreer.map(s => ({
          id: nouveauId.get(s.id)!, etablissement_id, annee_scolaire_id: data.annee_cible_id,
          nom_fr: s.nom_fr, nom_ar: s.nom_ar, filiere_id: s.filiere_id, niveau_id: s.niveau_id,
          capacite: s.capacite, programme_par_periode: data.matieres === 'copier' ? s.programme_par_periode : false,
          code: s.code,
        })),
      });
      if (liens.length > 0) {
        await tx.classeMatiere.createMany({
          data: liens.map(l => ({
            classe_id: nouveauId.get(l.classe_id)!, matiere_id: l.matiere_id,
            coeff_override: l.coeff_override, ordre_override: l.ordre_override,
            note_max_override: l.note_max_override, evaluee: l.evaluee,
          })),
        });
      }
      if (periodes.length > 0) {
        await tx.classeMatierePeriode.createMany({
          data: periodes.map(p => ({
            classe_id: nouveauId.get(p.classe_id)!, matiere_id: p.matiere_id,
            periode: p.periode, coeff: p.coeff, note_max: p.note_max, evaluee: p.evaluee,
          })),
        });
      }
    }, { timeout: 30000 });

    await logAction(etablissement_id, acteurId, 'CREATE', 'Classe', 'reconduction', {
      count: aCreer.length, source: data.annee_source_id, cible: data.annee_cible_id, matieres: data.matieres,
    });
  }

  const lignes: LigneReconduction[] = sources.map(s => ({
    classe_source_id: s.id,
    nom_fr: s.nom_fr,
    filiere: s.filiere_ref.code,
    niveau: s.niveau?.libelle ?? null,
    nb_matieres: data.matieres === 'copier' ? s._count.classe_matieres : 0,
    statut: nouveauId.has(s.id) ? (data.apercu ? 'a_creer' : 'creee') : 'existe',
  }));
  return {
    apercu: data.apercu,
    lignes,
    resume: { creees: aCreer.length, ignorees: sources.length - aCreer.length, total: sources.length },
  };
}
