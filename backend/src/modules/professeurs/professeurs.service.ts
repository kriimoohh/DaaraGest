import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { ProfesseurInput } from './professeurs.schema';

export async function listerProfesseurs(etablissement_id: string, page = 1, search?: string) {
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    etablissement_id,
    actif: true,
    professeur: { isNot: null },
  };

  if (search) {
    where.OR = [
      { nom_fr: { contains: search, mode: 'insensitive' } },
      { nom_ar: { contains: search, mode: 'insensitive' } },
      { identifiant: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.utilisateur.count({ where }),
    prisma.utilisateur.findMany({
      where,
      skip,
      take: limit,
      include: { professeur: true, role: true },
      orderBy: [{ nom_fr: 'asc' }],
    }),
  ]);

  return { total, page, limit, data: items };
}

export async function getProfesseur(id: string, etablissement_id: string) {
  const professeur = await prisma.professeur.findFirst({
    where: {
      id,
      utilisateur: { etablissement_id },
    },
    include: {
      utilisateur: { include: { role: true } },
      matieres_classes: { include: { matiere: true, classe: true } },
    },
  });
  if (!professeur) throw new Error('Professeur introuvable');
  return professeur;
}

export async function creerProfesseur(etablissement_id: string, data: ProfesseurInput) {
  const roleProf = await prisma.role.findFirst({ where: { libelle_fr: 'professeur' } });
  if (!roleProf) throw new Error('Rôle professeur introuvable');

  const hashedPassword = await bcrypt.hash(data.mot_de_passe, 10);

  const utilisateur = await prisma.utilisateur.create({
    data: {
      etablissement_id,
      role_id: roleProf.id,
      nom_fr: data.nom_fr,
      nom_ar: data.nom_ar,
      identifiant: data.identifiant,
      mot_de_passe: hashedPassword,
    },
  });

  const professeur = await prisma.professeur.create({
    data: {
      utilisateur_id: utilisateur.id,
      specialite_fr: data.specialite_fr,
      specialite_ar: data.specialite_ar,
      telephone: data.telephone,
      date_embauche: data.date_embauche ? new Date(data.date_embauche) : undefined,
      type_contrat: data.type_contrat ?? 'permanent',
      salaire_base: data.salaire_base,
      photo_url: data.photo_url,
    },
    include: { utilisateur: true },
  });

  return professeur;
}

export async function modifierProfesseur(id: string, etablissement_id: string, data: Partial<ProfesseurInput>) {
  const professeur = await prisma.professeur.findFirst({
    where: { id, utilisateur: { etablissement_id } },
    include: { utilisateur: true },
  });
  if (!professeur) throw new Error('Professeur introuvable');

  const updateTasks: Promise<unknown>[] = [];

  if (data.nom_fr || data.nom_ar) {
    updateTasks.push(
      prisma.utilisateur.update({
        where: { id: professeur.utilisateur_id },
        data: {
          nom_fr: data.nom_fr,
          nom_ar: data.nom_ar,
        },
      })
    );
  }

  updateTasks.push(
    prisma.professeur.update({
      where: { id },
      data: {
        specialite_fr: data.specialite_fr,
        specialite_ar: data.specialite_ar,
        telephone: data.telephone,
        date_embauche: data.date_embauche ? new Date(data.date_embauche) : undefined,
        type_contrat: data.type_contrat,
        salaire_base: data.salaire_base,
        photo_url: data.photo_url,
      },
      include: { utilisateur: true },
    })
  );

  const results = await Promise.all(updateTasks);
  return results[results.length - 1];
}

export async function supprimerProfesseur(id: string, etablissement_id: string) {
  const professeur = await prisma.professeur.findFirst({
    where: { id, utilisateur: { etablissement_id } },
    include: { utilisateur: true },
  });
  if (!professeur) throw new Error('Professeur introuvable');

  return prisma.utilisateur.update({
    where: { id: professeur.utilisateur_id },
    data: { actif: false },
  });
}
