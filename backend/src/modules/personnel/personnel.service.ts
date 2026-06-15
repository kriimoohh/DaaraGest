import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { PersonnelInput, AffectationInput } from './personnel.schema';
import { NotFoundError, ValidationError, ConflictError } from '../../utils/errors';
import { genererMatricule } from '../../utils/matricule';

export async function listerPersonnel(etablissement_id: string, page = 1, search?: string, fonction?: string, specialite?: string) {
  const limit = 20;
  const skip = (page - 1) * limit;

  // Filtres sur la relation Personnel (fonction exacte, spécialité « contient »).
  const personnelIs: Record<string, unknown> = {};
  if (fonction) personnelIs.fonction = fonction;
  if (specialite) personnelIs.specialite_fr = { contains: specialite, mode: 'insensitive' };
  const personnelFilter: Record<string, unknown> =
    Object.keys(personnelIs).length > 0 ? { is: personnelIs } : { isNot: null };

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
      date_naissance:   data.date_naissance   ? new Date(data.date_naissance)   : undefined,
      lieu_naissance:        data.lieu_naissance        ?? undefined,
      cni:                   data.cni                   ?? undefined,
      numero_autorisation:   data.numero_autorisation   ?? undefined,
      diplome_academique:    data.diplome_academique    ?? undefined,
      diplome_professionnel: data.diplome_professionnel ?? undefined,
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
        date_naissance:   parseDate(data.date_naissance),
        lieu_naissance:        data.lieu_naissance        === undefined ? undefined : (data.lieu_naissance        || null),
        cni:                   data.cni                   === undefined ? undefined : (data.cni                   || null),
        numero_autorisation:   data.numero_autorisation   === undefined ? undefined : (data.numero_autorisation   || null),
        diplome_academique:    data.diplome_academique    === undefined ? undefined : (data.diplome_academique    || null),
        diplome_professionnel: data.diplome_professionnel === undefined ? undefined : (data.diplome_professionnel || null),
      },
      include: { utilisateur: true },
    })
  );

  const results = await Promise.all(updateTasks);
  return results[results.length - 1];
}

// ── Affectations matière × classe (PersonnelMatiereClasse) ──────────────────
// Rattache un enseignant à (classe, matière) pour l'année de la classe. C'est ce
// que consomme la politique de saisie des notes (cf. teachingPolicy.ts).

// Résout le personnel à partir d'un id pouvant être personnel_id OU utilisateur_id,
// en s'assurant qu'il appartient bien à l'établissement.
async function resoudrePersonnel(id: string, etablissement_id: string) {
  const prof = await prisma.personnel.findFirst({
    where: { OR: [{ id }, { utilisateur_id: id }], utilisateur: { etablissement_id } },
    select: { id: true },
  });
  if (!prof) throw new NotFoundError('Personnel introuvable');
  return prof;
}

const affectationInclude = {
  classe: { select: { id: true, nom_fr: true, filiere: true } },
  matiere: { select: { id: true, nom_fr: true, filiere: true } },
  annee_scolaire: { select: { id: true, libelle: true } },
} as const;

export async function listerAffectations(id: string, etablissement_id: string, annee_scolaire_id?: string) {
  const prof = await resoudrePersonnel(id, etablissement_id);
  return prisma.personnelMatiereClasse.findMany({
    where: { personnel_id: prof.id, ...(annee_scolaire_id ? { annee_scolaire_id } : {}) },
    include: affectationInclude,
    orderBy: [{ classe: { nom_fr: 'asc' } }, { matiere: { nom_fr: 'asc' } }],
  });
}

export async function ajouterAffectation(id: string, etablissement_id: string, data: AffectationInput) {
  const prof = await resoudrePersonnel(id, etablissement_id);

  // La classe détermine l'année scolaire de l'affectation.
  const classe = await prisma.classe.findFirst({
    where: { id: data.classe_id, etablissement_id },
    select: { id: true, annee_scolaire_id: true },
  });
  if (!classe) throw new NotFoundError('Classe introuvable');

  // La matière doit faire partie du programme de la classe (ClasseMatiere).
  const cm = await prisma.classeMatiere.findFirst({
    where: { classe_id: classe.id, matiere_id: data.matiere_id },
    select: { id: true },
  });
  if (!cm) throw new ValidationError('Cette matière ne fait pas partie du programme de la classe');

  const existing = await prisma.personnelMatiereClasse.findFirst({
    where: { personnel_id: prof.id, classe_id: classe.id, matiere_id: data.matiere_id, annee_scolaire_id: classe.annee_scolaire_id },
    select: { id: true },
  });
  if (existing) throw new ConflictError('Cet enseignant est déjà affecté à cette matière dans cette classe');

  return prisma.personnelMatiereClasse.create({
    data: {
      personnel_id: prof.id,
      classe_id: classe.id,
      matiere_id: data.matiere_id,
      annee_scolaire_id: classe.annee_scolaire_id,
    },
    include: affectationInclude,
  });
}

export async function supprimerAffectation(id: string, affectation_id: string, etablissement_id: string) {
  const prof = await resoudrePersonnel(id, etablissement_id);
  const lien = await prisma.personnelMatiereClasse.findFirst({
    where: { id: affectation_id, personnel_id: prof.id },
    select: { id: true },
  });
  if (!lien) throw new NotFoundError('Affectation introuvable');
  await prisma.personnelMatiereClasse.delete({ where: { id: lien.id } });
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
