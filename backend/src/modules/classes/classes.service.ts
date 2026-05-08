import prisma from '../../config/database';
import { ClasseInput } from './classes.schema';

export async function listerClasses(etablissement_id: string, annee_scolaire_id?: string) {
  return prisma.classe.findMany({
    where: {
      etablissement_id,
      active: true,
      ...(annee_scolaire_id ? { annee_scolaire_id } : {}),
    },
    include: { annee_scolaire: true },
    orderBy: [{ filiere: 'asc' }, { niveau: 'asc' }, { nom_fr: 'asc' }],
  });
}

export async function getClasse(id: string, etablissement_id: string) {
  const classe = await prisma.classe.findFirst({
    where: { id, etablissement_id },
    include: { annee_scolaire: true },
  });
  if (!classe) throw new Error('Classe introuvable');
  return classe;
}

export async function creerClasse(etablissement_id: string, data: ClasseInput) {
  return prisma.classe.create({
    data: {
      etablissement_id,
      nom_fr: data.nom_fr,
      filiere: data.filiere,
      niveau: data.niveau,
      annee_scolaire_id: data.annee_scolaire_id,
      capacite: data.capacite ?? 30,
    },
  });
}

export async function modifierClasse(id: string, etablissement_id: string, data: ClasseInput) {
  const existing = await prisma.classe.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Classe introuvable');

  return prisma.classe.update({
    where: { id },
    data: {
      nom_fr: data.nom_fr,
      filiere: data.filiere,
      niveau: data.niveau,
      annee_scolaire_id: data.annee_scolaire_id,
      capacite: data.capacite,
    },
  });
}

export async function supprimerClasse(id: string, etablissement_id: string) {
  const existing = await prisma.classe.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Classe introuvable');

  return prisma.classe.update({ where: { id }, data: { active: false } });
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
  if (!classe) throw new Error('Classe introuvable');

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
