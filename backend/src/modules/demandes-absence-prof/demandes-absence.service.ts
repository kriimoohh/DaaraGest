import prisma from '../../config/database';
import { CreerDemandeInput, TraiterDemandeInput } from './demandes-absence.schema';

export async function listerDemandes(etablissement_id: string, statut?: string) {
  return prisma.demandeAbsenceProfesseur.findMany({
    where: {
      etablissement_id,
      ...(statut ? { statut } : {}),
    },
    include: {
      professeur: { include: { utilisateur: true } },
      traiteur: true,
    },
    orderBy: { created_at: 'desc' },
  });
}

export async function creerDemande(etablissement_id: string, data: CreerDemandeInput) {
  return prisma.demandeAbsenceProfesseur.create({
    data: {
      etablissement_id,
      professeur_id: data.professeur_id,
      date_debut:    new Date(data.date_debut),
      date_fin:      new Date(data.date_fin),
      motif:         data.motif,
      type_absence:  data.type_absence,
    },
    include: {
      professeur: { include: { utilisateur: true } },
    },
  });
}

export async function traiterDemande(
  id: string,
  etablissement_id: string,
  traite_par: string,
  data: TraiterDemandeInput,
) {
  const demande = await prisma.demandeAbsenceProfesseur.findUniqueOrThrow({ where: { id } });
  if (demande.etablissement_id !== etablissement_id) {
    throw Object.assign(new Error('Ressource introuvable'), { statusCode: 404 });
  }
  if (demande.statut !== 'EN_ATTENTE') {
    throw Object.assign(new Error('Cette demande a déjà été traitée'), { statusCode: 400 });
  }
  return prisma.demandeAbsenceProfesseur.update({
    where: { id },
    data: {
      statut:      data.statut,
      commentaire: data.commentaire ?? null,
      traite_par,
      traite_le:   new Date(),
    },
    include: {
      professeur: { include: { utilisateur: true } },
      traiteur: true,
    },
  });
}

export async function supprimerDemande(id: string, etablissement_id: string) {
  const demande = await prisma.demandeAbsenceProfesseur.findUniqueOrThrow({ where: { id } });
  if (demande.etablissement_id !== etablissement_id) {
    throw Object.assign(new Error('Ressource introuvable'), { statusCode: 404 });
  }
  if (demande.statut !== 'EN_ATTENTE') {
    throw Object.assign(new Error('Seules les demandes en attente peuvent être supprimées'), { statusCode: 400 });
  }
  return prisma.demandeAbsenceProfesseur.delete({ where: { id } });
}
