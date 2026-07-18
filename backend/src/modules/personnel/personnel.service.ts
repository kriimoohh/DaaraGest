import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { PersonnelInput, AffectationInput } from './personnel.schema';
import { NotFoundError, ValidationError, ConflictError } from '../../utils/errors';
import { genererMatricule } from '../../utils/matricule';
import { sansMotDePasse, epurerPersonnelPourRole } from '../../utils/sanitize';

export async function listerPersonnel(etablissement_id: string, role: string, page = 1, search?: string, fonction?: string, specialite?: string, annee_scolaire_id?: string, limit = 20) {
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

  // Affectations (classes) pour l'année demandée — pour l'affichage carte.
  const matieresClassesInclude = {
    where: annee_scolaire_id ? { annee_scolaire_id } : undefined,
    select: {
      classe: { select: { id: true, nom_fr: true, filiere_ref: { select: { code: true } } } },
    },
  };

  const [total, items] = await Promise.all([
    prisma.utilisateur.count({ where }),
    prisma.utilisateur.findMany({
      where,
      skip,
      take: limit,
      include: {
        role: true,
        personnel: { include: { matieres_classes: matieresClassesInclude } },
      },
      orderBy: [{ nom_fr: 'asc' }],
    }),
  ]);

  // Réduit matieres_classes (1 ligne/matière) en classes distinctes.
  // Épuration systématique : jamais de hash de mot de passe ; salaire/CNI/QR
  // réservés aux rôles de gestion (annuaire seulement pour prof/pointeur).
  const data = items.map((u) => {
    const liens = u.personnel?.matieres_classes ?? [];
    const parClasse = new Map<string, { id: string; nom_fr: string; filiere: string }>();
    // `filiere` exposé depuis la relation (colonne string supprimée en Phase 2d).
    for (const l of liens) parClasse.set(l.classe.id, { id: l.classe.id, nom_fr: l.classe.nom_fr, filiere: l.classe.filiere_ref.code });
    const classes_assignees = [...parClasse.values()]
      .sort((a, b) => a.nom_fr.localeCompare(b.nom_fr, 'fr'))
      .map((classe) => ({ classe }));
    const personnel = u.personnel ? (() => { const { matieres_classes: _omit, ...rest } = u.personnel; return epurerPersonnelPourRole(rest, role); })() : u.personnel;
    return { ...sansMotDePasse(u), personnel, classes_assignees };
  });

  return { total, page, limit, data };
}

export async function getPersonnel(id: string, etablissement_id: string, role: string) {
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
  // Jamais de hash ; fiche RH (salaire/CNI/QR) réservée aux rôles de gestion.
  return epurerPersonnelPourRole({ ...professeur, utilisateur: sansMotDePasse(professeur.utilisateur) }, role);
}

export async function creerPersonnel(etablissement_id: string, data: PersonnelInput) {
  const roleProf = await prisma.role.findFirst({ where: { libelle_fr: 'professeur' } });
  if (!roleProf) throw new NotFoundError('Rôle professeur introuvable');

  // `identifiant` est unique au niveau global (tous établissements confondus).
  // On pré-vérifie pour renvoyer un message clair (409) au lieu du P2002 brut
  // que le handler traduirait en un vague « Données invalides ».
  const identifiantPris = await prisma.utilisateur.findFirst({
    where: { identifiant: data.identifiant },
    select: { id: true },
  });
  if (identifiantPris) throw new ConflictError('Cet identifiant est déjà utilisé');

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

  return { ...professeur, utilisateur: sansMotDePasse(professeur.utilisateur) };
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
  const dernier = results[results.length - 1] as { utilisateur?: Record<string, unknown> } & Record<string, unknown>;
  return dernier.utilisateur ? { ...dernier, utilisateur: sansMotDePasse(dernier.utilisateur) } : dernier;
}

// ── Affectations par classe (PersonnelMatiereClasse) ────────────────────────
// Unité d'affectation = une CLASSE entière. En base, l'affectation reste stockée
// par matière (une ligne par matière du programme de la classe), car c'est ce que
// consomme la politique de saisie des notes (teachingPolicy.ts). L'API et l'UI
// raisonnent « par classe » ; l'expansion vers toutes les matières du programme
// est faite ici.

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

export interface AffectationGroupe {
  classe: { id: string; nom_fr: string; filiere: string };
  annee_scolaire: { id: string; libelle: string };
  nb_matieres: number;
}

/** Liste les affectations du personnel, groupées par classe. */
export async function listerAffectations(id: string, etablissement_id: string, annee_scolaire_id?: string): Promise<AffectationGroupe[]> {
  const prof = await resoudrePersonnel(id, etablissement_id);
  const liens = await prisma.personnelMatiereClasse.findMany({
    where: { personnel_id: prof.id, ...(annee_scolaire_id ? { annee_scolaire_id } : {}) },
    select: {
      classe: { select: { id: true, nom_fr: true, filiere_ref: { select: { code: true } } } },
      annee_scolaire: { select: { id: true, libelle: true } },
    },
  });
  const map = new Map<string, AffectationGroupe>();
  for (const l of liens) {
    const e = map.get(l.classe.id);
    if (e) e.nb_matieres += 1;
    // `filiere` exposé depuis la relation (colonne string supprimée en Phase 2d).
    else map.set(l.classe.id, { classe: { id: l.classe.id, nom_fr: l.classe.nom_fr, filiere: l.classe.filiere_ref.code }, annee_scolaire: l.annee_scolaire, nb_matieres: 1 });
  }
  return [...map.values()].sort((a, b) => a.classe.nom_fr.localeCompare(b.classe.nom_fr, 'fr'));
}

/** Affecte le personnel à une classe entière (toutes les matières de son programme). */
export async function ajouterAffectation(id: string, etablissement_id: string, data: AffectationInput) {
  const prof = await resoudrePersonnel(id, etablissement_id);

  const classe = await prisma.classe.findFirst({
    where: { id: data.classe_id, etablissement_id },
    select: { id: true, annee_scolaire_id: true },
  });
  if (!classe) throw new NotFoundError('Classe introuvable');

  // Toutes les matières du programme de la classe.
  const programme = await prisma.classeMatiere.findMany({
    where: { classe_id: classe.id },
    select: { matiere_id: true },
  });
  if (programme.length === 0) {
    throw new ValidationError('Aucune matière dans le programme de la classe');
  }

  // N'insère que les matières pas encore affectées (pas de contrainte d'unicité en base).
  const existantes = new Set(
    (await prisma.personnelMatiereClasse.findMany({
      where: { personnel_id: prof.id, classe_id: classe.id, annee_scolaire_id: classe.annee_scolaire_id },
      select: { matiere_id: true },
    })).map(r => r.matiere_id),
  );
  const aCreer = programme.filter(p => !existantes.has(p.matiere_id));
  if (aCreer.length === 0) {
    throw new ConflictError('Cet enseignant est déjà affecté à cette classe');
  }

  await prisma.personnelMatiereClasse.createMany({
    data: aCreer.map(p => ({
      personnel_id: prof.id,
      classe_id: classe.id,
      matiere_id: p.matiere_id,
      annee_scolaire_id: classe.annee_scolaire_id,
    })),
  });

  return listerAffectations(id, etablissement_id, classe.annee_scolaire_id);
}

/** Retire le personnel d'une classe (toutes ses matières). */
export async function supprimerAffectation(id: string, classe_id: string, etablissement_id: string) {
  const prof = await resoudrePersonnel(id, etablissement_id);
  const classe = await prisma.classe.findFirst({
    where: { id: classe_id, etablissement_id },
    select: { id: true, annee_scolaire_id: true },
  });
  if (!classe) throw new NotFoundError('Classe introuvable');

  const { count } = await prisma.personnelMatiereClasse.deleteMany({
    where: {
      personnel_id: prof.id,
      classe_id: classe.id,
      annee_scolaire_id: classe.annee_scolaire_id,
    },
  });
  if (count === 0) throw new NotFoundError('Affectation introuvable');
}

export async function supprimerPersonnel(id: string, etablissement_id: string) {
  const professeur = await prisma.personnel.findFirst({
    where: { OR: [{ id }, { utilisateur_id: id }], utilisateur: { etablissement_id } },
    include: { utilisateur: true },
  });
  if (!professeur) throw new NotFoundError('Personnel introuvable');

  // Suffixer l'identifiant pour libérer le slot unique (comme le module
  // Utilisateurs) : sans ça, un personnel supprimé garde son identifiant occupé
  // et bloque toute recréation avec le même identifiant.
  const identifiantLibere = `${professeur.utilisateur.identifiant}_deleted_${Date.now()}`;
  const maj = await prisma.utilisateur.update({
    where: { id: professeur.utilisateur_id },
    data: { actif: false, identifiant: identifiantLibere },
  });
  return sansMotDePasse(maj);
}
