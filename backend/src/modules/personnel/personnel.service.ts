import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { PersonnelInput } from './personnel.schema';
import { NotFoundError } from '../../utils/errors';
import { genererMatricule } from '../../utils/matricule';

export async function listerPersonnel(etablissement_id: string, page = 1, search?: string, fonction?: string) {
  const limit = 20;
  const skip = (page - 1) * limit;

  const personnelFilter: Record<string, unknown> = { isNot: null };
  if (fonction) {
    personnelFilter.is = { fonction };
  }

  const where: Record<string, unknown> = {
    etablissement_id,
    actif: true,
    personnel: personnelFilter,
  };

  if (search) {
    where.OR = [
      { nom_fr: { contains: search, mode: 'insensitive' } },
      { identifiant: { contains: search, mode: 'insensitive' } },
      { personnel: { is: { matricule: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.utilisateur.count({ where }),
    prisma.utilisateur.findMany({
      where,
      skip,
      take: limit,
      include: { personnel: true, role: true },
      orderBy: [{ nom_fr: 'asc' }],
    }),
  ]);

  return { total, page, limit, data: items };
}

export async function getPersonnel(id: string, etablissement_id: string) {
  const professeur = await prisma.personnel.findFirst({
    where: {
      id,
      utilisateur: { etablissement_id },
    },
    include: {
      utilisateur: { include: { role: true } },
      matieres_classes: { include: { matiere: true, classe: true } },
    },
  });
  if (!professeur) throw new NotFoundError('Personnel introuvable');
  return professeur;
}

export async function creerPersonnel(etablissement_id: string, data: PersonnelInput) {
  const roleProf = await prisma.role.findFirst({ where: { libelle_fr: 'professeur' } });
  if (!roleProf) throw new NotFoundError('Rôle professeur introuvable');

  const hashedPassword = await bcrypt.hash(data.mot_de_passe, 10);
  const matricule = data.matricule || await genererMatricule(etablissement_id, 'P');

  const utilisateur = await prisma.utilisateur.create({
    data: {
      etablissement_id,
      role_id: roleProf.id,
      nom_fr: data.nom_fr,
      prenom_fr: data.prenom_fr ?? null,
      sexe: data.sexe ?? undefined,
      identifiant: data.identifiant,
      email: data.email ?? null,
      mot_de_passe: hashedPassword,
      // Comme le module Utilisateurs : le personnel doit changer le mot de passe
      // attribué dès sa première connexion.
      must_change_password: true,
    },
  });

  const professeur = await prisma.personnel.create({
    data: {
      utilisateur_id: utilisateur.id,
      matricule,
      fonction: data.fonction ?? 'ENSEIGNANT',
      specialite_fr: data.specialite_fr,
      telephone: data.telephone,
      date_embauche: data.date_embauche ? new Date(data.date_embauche) : undefined,
      type_contrat: data.type_contrat ?? 'permanent',
      salaire_base: data.salaire_base,
      photo_url: data.photo_url,
      poste_fr: data.poste_fr,
      date_fin_contrat: data.date_fin_contrat ? new Date(data.date_fin_contrat) : undefined,
      date_debut_stage: data.date_debut_stage ? new Date(data.date_debut_stage) : undefined,
      date_fin_stage:   data.date_fin_stage   ? new Date(data.date_fin_stage)   : undefined,
    },
    include: { utilisateur: true },
  });

  return professeur;
}

export async function modifierPersonnel(id: string, etablissement_id: string, data: Partial<PersonnelInput>) {
  // id peut être utilisateur_id ou personnel_id — on cherche les deux
  const professeur = await prisma.personnel.findFirst({
    where: { OR: [{ id }, { utilisateur_id: id }], utilisateur: { etablissement_id } },
    include: { utilisateur: true },
  });
  if (!professeur) throw new NotFoundError('Personnel introuvable');

  const updateTasks: Promise<unknown>[] = [];

  if (
    data.nom_fr ||
    data.prenom_fr !== undefined ||
    data.email !== undefined ||
    data.sexe !== undefined
  ) {
    updateTasks.push(
      prisma.utilisateur.update({
        where: { id: professeur.utilisateur_id },
        data: {
          nom_fr: data.nom_fr,
          prenom_fr: data.prenom_fr === undefined ? undefined : (data.prenom_fr || null),
          email:     data.email     === undefined ? undefined : (data.email     || null),
          sexe: data.sexe === undefined ? undefined : data.sexe,
        },
      })
    );
  }

  // null → clear, undefined → no change, string → parse Date
  const parseDate = (v: string | null | undefined) =>
    v === undefined ? undefined : v === null ? null : new Date(v);

  updateTasks.push(
    prisma.personnel.update({
      where: { id: professeur.id },
      data: {
        matricule: data.matricule,
        fonction: data.fonction,
        specialite_fr: data.specialite_fr,
        telephone: data.telephone,
        date_embauche: data.date_embauche ? new Date(data.date_embauche) : undefined,
        type_contrat: data.type_contrat,
        salaire_base: data.salaire_base,
        photo_url: data.photo_url,
        poste_fr: data.poste_fr,
        date_fin_contrat: parseDate(data.date_fin_contrat),
        date_debut_stage: parseDate(data.date_debut_stage),
        date_fin_stage:   parseDate(data.date_fin_stage),
      },
      include: { utilisateur: true },
    })
  );

  const results = await Promise.all(updateTasks);
  return results[results.length - 1];
}

export async function supprimerPersonnel(id: string, etablissement_id: string) {
  const professeur = await prisma.personnel.findFirst({
    where: { OR: [{ id }, { utilisateur_id: id }], utilisateur: { etablissement_id } },
    include: { utilisateur: true },
  });
  if (!professeur) throw new NotFoundError('Personnel introuvable');

  return prisma.utilisateur.update({
    where: { id: professeur.utilisateur_id },
    data: { actif: false },
  });
}
