import prisma from '../../config/database';
import { LivreInput, UpdateLivreInput, EmpruntInput, RetourInput } from './bibliotheque.schema';

// ─── Livres ──────────────────────────────────────────────────────────────────

export async function listerLivres(etablissement_id: string, search?: string, page = 1) {
  const limit = 20;
  const skip  = (page - 1) * limit;
  const where: Record<string, unknown> = { etablissement_id, actif: true };
  if (search) {
    where.OR = [
      { titre:  { contains: search, mode: 'insensitive' } },
      { auteur: { contains: search, mode: 'insensitive' } },
      { isbn:   { contains: search, mode: 'insensitive' } },
    ];
  }
  const [total, items] = await Promise.all([
    prisma.livreStock.count({ where }),
    prisma.livreStock.findMany({ where, skip, take: limit, orderBy: { titre: 'asc' } }),
  ]);
  return { total, page, limit, data: items };
}

export async function creerLivre(etablissement_id: string, data: LivreInput) {
  return prisma.livreStock.create({
    data: { ...data, etablissement_id, quantite_dispo: data.quantite_totale ?? 1 },
  });
}

export async function modifierLivre(id: string, etablissement_id: string, data: UpdateLivreInput) {
  const existing = await prisma.livreStock.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Livre introuvable');
  return prisma.livreStock.update({ where: { id }, data });
}

export async function supprimerLivre(id: string, etablissement_id: string) {
  const existing = await prisma.livreStock.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Livre introuvable');
  return prisma.livreStock.update({ where: { id }, data: { actif: false } });
}

// ─── Emprunts ────────────────────────────────────────────────────────────────

export async function listerEmprunts(
  etablissement_id: string,
  statut?: string,
  eleve_id?: string,
  page = 1,
) {
  const limit = 20;
  const skip  = (page - 1) * limit;
  const where: Record<string, unknown> = { etablissement_id };
  if (statut)   where.statut   = statut;
  if (eleve_id) where.eleve_id = eleve_id;

  const [total, items] = await Promise.all([
    prisma.emprunt.count({ where }),
    prisma.emprunt.findMany({
      where,
      skip,
      take: limit,
      include: {
        livre: { select: { id: true, titre: true, auteur: true, isbn: true } },
        eleve: { select: { id: true, nom_fr: true, prenom_fr: true, matricule: true } },
      },
      orderBy: { created_at: 'desc' },
    }),
  ]);
  return { total, page, limit, data: items };
}

export async function creerEmprunt(etablissement_id: string, data: EmpruntInput, cree_par: string) {
  const livre = await prisma.livreStock.findFirst({ where: { id: data.livre_id, etablissement_id, actif: true } });
  if (!livre) throw new Error('Livre introuvable');
  if (livre.quantite_dispo <= 0) throw new Error('Aucun exemplaire disponible');

  const eleve = await prisma.eleve.findFirst({ where: { id: data.eleve_id, etablissement_id } });
  if (!eleve) throw new Error('Élève introuvable');

  const [emprunt] = await prisma.$transaction([
    prisma.emprunt.create({
      data: {
        etablissement_id,
        livre_id: data.livre_id,
        eleve_id: data.eleve_id,
        date_retour_prevue: new Date(data.date_retour_prevue),
        cree_par,
      },
      include: {
        livre: { select: { id: true, titre: true } },
        eleve: { select: { id: true, nom_fr: true, prenom_fr: true, matricule: true } },
      },
    }),
    prisma.livreStock.update({ where: { id: data.livre_id }, data: { quantite_dispo: { decrement: 1 } } }),
  ]);

  return emprunt;
}

export async function enregistrerRetour(id: string, etablissement_id: string, data: RetourInput) {
  const emprunt = await prisma.emprunt.findFirst({ where: { id, etablissement_id, statut: 'en_cours' } });
  if (!emprunt) throw new Error('Emprunt introuvable ou déjà clôturé');

  const [updated] = await prisma.$transaction([
    prisma.emprunt.update({
      where: { id },
      data: { statut: data.statut, date_retour_effective: new Date() },
    }),
    prisma.livreStock.update({
      where: { id: emprunt.livre_id },
      data: { quantite_dispo: { increment: data.statut === 'rendu' ? 1 : 0 } },
    }),
  ]);

  return updated;
}

export async function listerEnRetard(etablissement_id: string) {
  const aujourd_hui = new Date();
  return prisma.emprunt.findMany({
    where: {
      etablissement_id,
      statut: 'en_cours',
      date_retour_prevue: { lt: aujourd_hui },
    },
    include: {
      livre: { select: { titre: true, auteur: true } },
      eleve: { select: { nom_fr: true, prenom_fr: true, matricule: true } },
    },
    orderBy: { date_retour_prevue: 'asc' },
  });
}
