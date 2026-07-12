import prisma from '../../config/database';
import { MatiereInput } from './matieres.schema';
import { NotFoundError } from '../../utils/errors';
import { getFiliereActiveId, getFiliereId } from '../../utils/filiere';

// La colonne string `filiere` a été supprimée (Phase 2d) : la réponse API
// continue d'exposer le code (`filiere`) depuis la relation, pour le frontend.
const INCLUDE_MATIERE = {
  domaine: { select: { id: true, nom_fr: true, code: true, ordre: true } },
  filiere_ref: { select: { code: true } },
} as const;

type MatiereAvecRefs = { filiere_ref: { code: string } };
const exposeCode = <T extends MatiereAvecRefs>(m: T) => ({ ...m, filiere: m.filiere_ref.code });

export async function listerMatieres(etablissement_id: string, filiere?: string) {
  const rows = await prisma.matiere.findMany({
    where: { etablissement_id, active: true, ...(filiere ? { filiere_ref: { code: filiere } } : {}) },
    orderBy: [{ filiere_ref: { code: 'asc' } }, { ordre_bulletin: 'asc' }],
    include: INCLUDE_MATIERE,
  });
  return rows.map(exposeCode);
}

async function verifierDomaine(etablissement_id: string, domaine_id: string | null | undefined) {
  if (!domaine_id) return;
  const dom = await prisma.domaine.findFirst({ where: { id: domaine_id, etablissement_id } });
  if (!dom) {
    throw Object.assign(new NotFoundError('Domaine introuvable pour cet établissement'), { statusCode: 400 });
  }
}

export async function creerMatiere(etablissement_id: string, data: MatiereInput) {
  await verifierDomaine(etablissement_id, data.domaine_id);
  // Récupérer les valeurs globales comme défaut
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  // La filière doit être configurée et active.
  const filiere_id = await getFiliereActiveId(etablissement_id, data.filiere);
  const created = await prisma.matiere.create({
    data: {
      etablissement_id,
      nom_fr: data.nom_fr,
      nom_ar: data.nom_ar?.trim() ? data.nom_ar.trim() : null,
      filiere_id,
      coeff_defaut: data.coeff_defaut ?? 1,
      note_min: data.note_min ?? Number(config?.note_min ?? 0),
      note_max: data.note_max ?? null,
      ordre_bulletin: data.ordre_bulletin ?? 0,
      domaine_id: data.domaine_id ?? null,
      type_note: data.type_note ?? 'SIMPLE',
      code_court: data.code_court?.trim() ? data.code_court.trim() : null,
    },
    include: INCLUDE_MATIERE,
  });
  return exposeCode(created);
}

export async function modifierMatiere(id: string, etablissement_id: string, data: MatiereInput) {
  const existing = await prisma.matiere.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new NotFoundError('Matière introuvable');
  await verifierDomaine(etablissement_id, data.domaine_id);
  const filiere_id = await getFiliereId(etablissement_id, data.filiere);
  const updated = await prisma.matiere.update({
    where: { id },
    data: {
      nom_fr: data.nom_fr,
      nom_ar: data.nom_ar?.trim() ? data.nom_ar.trim() : null,
      filiere_id,
      coeff_defaut: data.coeff_defaut,
      note_min: data.note_min,
      note_max: data.note_max,
      ordre_bulletin: data.ordre_bulletin,
      domaine_id: data.domaine_id ?? null,
      type_note: data.type_note ?? 'SIMPLE',
      code_court: data.code_court?.trim() ? data.code_court.trim() : null,
    },
    include: INCLUDE_MATIERE,
  });
  return exposeCode(updated);
}

export async function supprimerMatiere(id: string, etablissement_id: string) {
  const existing = await prisma.matiere.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new NotFoundError('Matière introuvable');
  return prisma.matiere.update({ where: { id }, data: { active: false } });
}
