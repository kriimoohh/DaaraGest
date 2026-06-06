import prisma from '../../config/database';
import { MatiereInput } from './matieres.schema';

export async function listerMatieres(etablissement_id: string, filiere?: string) {
  return prisma.matiere.findMany({
    where: { etablissement_id, active: true, ...(filiere ? { filiere } : {}) },
    orderBy: [{ filiere: 'asc' }, { ordre_bulletin: 'asc' }],
    include: { domaine: { select: { id: true, nom_fr: true, code: true, ordre: true } } },
  });
}

async function verifierDomaine(etablissement_id: string, domaine_id: string | null | undefined) {
  if (!domaine_id) return;
  const dom = await prisma.domaine.findFirst({ where: { id: domaine_id, etablissement_id } });
  if (!dom) {
    throw Object.assign(new Error('Domaine introuvable pour cet établissement'), { statusCode: 400 });
  }
}

export async function creerMatiere(etablissement_id: string, data: MatiereInput) {
  await verifierDomaine(etablissement_id, data.domaine_id);
  // Récupérer les valeurs globales comme défaut
  const config = await prisma.configNotes.findUnique({ where: { etablissement_id } });
  return prisma.matiere.create({
    data: {
      etablissement_id,
      nom_fr: data.nom_fr,
      nom_ar: data.nom_ar?.trim() ? data.nom_ar.trim() : null,
      filiere: data.filiere,
      coeff_defaut: data.coeff_defaut ?? 1,
      note_min: data.note_min ?? Number(config?.note_min ?? 0),
      ordre_bulletin: data.ordre_bulletin ?? 0,
      domaine_id: data.domaine_id ?? null,
      type_note: data.type_note ?? 'SIMPLE',
      code_court: data.code_court?.trim() ? data.code_court.trim() : null,
    },
    include: { domaine: { select: { id: true, nom_fr: true, code: true, ordre: true } } },
  });
}

export async function modifierMatiere(id: string, etablissement_id: string, data: MatiereInput) {
  const existing = await prisma.matiere.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Matière introuvable');
  await verifierDomaine(etablissement_id, data.domaine_id);
  return prisma.matiere.update({
    where: { id },
    data: {
      nom_fr: data.nom_fr,
      nom_ar: data.nom_ar?.trim() ? data.nom_ar.trim() : null,
      filiere: data.filiere,
      coeff_defaut: data.coeff_defaut,
      note_min: data.note_min,
      ordre_bulletin: data.ordre_bulletin,
      domaine_id: data.domaine_id ?? null,
      type_note: data.type_note ?? 'SIMPLE',
      code_court: data.code_court?.trim() ? data.code_court.trim() : null,
    },
    include: { domaine: { select: { id: true, nom_fr: true, code: true, ordre: true } } },
  });
}

export async function supprimerMatiere(id: string, etablissement_id: string) {
  const existing = await prisma.matiere.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Matière introuvable');
  return prisma.matiere.update({ where: { id }, data: { active: false } });
}
