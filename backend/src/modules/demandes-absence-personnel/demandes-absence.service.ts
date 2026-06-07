import prisma from '../../config/database';
import { CreerDemandeInput, TraiterDemandeInput } from './demandes-absence.schema';
import { NotFoundError, ValidationError } from '../../utils/errors';

export async function listerDemandes(etablissement_id: string, statut?: string) {
  return prisma.demandeAbsencePersonnel.findMany({
    where: {
      etablissement_id,
      ...(statut ? { statut } : {}),
    },
    include: {
      personnel: { include: { utilisateur: true } },
      traiteur: true,
    },
    orderBy: { created_at: 'desc' },
  });
}

export async function creerDemande(etablissement_id: string, data: CreerDemandeInput) {
  // Multi-tenant strict : le personnel ciblé doit appartenir à l'établissement
  // du demandeur (sinon on pourrait créer une demande pour un personnel d'un
  // autre établissement en forgeant personnel_id).
  const personnel = await prisma.personnel.findFirst({
    where: { id: data.personnel_id, utilisateur: { etablissement_id } },
    select: { id: true },
  });
  if (!personnel) throw new NotFoundError('Personnel introuvable');

  return prisma.demandeAbsencePersonnel.create({
    data: {
      etablissement_id,
      personnel_id: data.personnel_id,
      date_debut:    new Date(data.date_debut),
      date_fin:      new Date(data.date_fin),
      motif:         data.motif,
      type_absence:  data.type_absence,
    },
    include: {
      personnel: { include: { utilisateur: true } },
    },
  });
}

export async function traiterDemande(
  id: string,
  etablissement_id: string,
  traite_par: string,
  data: TraiterDemandeInput,
) {
  const demande = await prisma.demandeAbsencePersonnel.findUniqueOrThrow({ where: { id } });
  if (demande.etablissement_id !== etablissement_id) {
    throw new NotFoundError('Demande introuvable');
  }
  if (demande.statut !== 'EN_ATTENTE') {
    throw new ValidationError('Cette demande a déjà été traitée');
  }
  return prisma.demandeAbsencePersonnel.update({
    where: { id },
    data: {
      statut:      data.statut,
      commentaire: data.commentaire ?? null,
      traite_par,
      traite_le:   new Date(),
    },
    include: {
      personnel: { include: { utilisateur: true } },
      traiteur: true,
    },
  });
}

export async function supprimerDemande(id: string, etablissement_id: string) {
  const demande = await prisma.demandeAbsencePersonnel.findUniqueOrThrow({ where: { id } });
  if (demande.etablissement_id !== etablissement_id) {
    throw new NotFoundError('Demande introuvable');
  }
  if (demande.statut !== 'EN_ATTENTE') {
    throw new ValidationError('Seules les demandes en attente peuvent être supprimées');
  }
  return prisma.demandeAbsencePersonnel.delete({ where: { id } });
}
