import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { logAction } from '../../utils/audit';
import { UtilisateurInput, ResetPasswordInput } from './utilisateurs.schema';

export async function listerRoles() {
  return prisma.role.findMany({ orderBy: { libelle_fr: 'asc' } });
}

export async function listerUtilisateurs(
  etablissement_id: string,
  page = 1,
  search?: string,
  role?: string
) {
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { etablissement_id };

  if (search) {
    where.OR = [
      { nom_fr: { contains: search, mode: 'insensitive' } },
      { nom_ar: { contains: search, mode: 'insensitive' } },
      { identifiant: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (role) {
    where.role = { libelle_fr: role };
  }

  const [total, items] = await Promise.all([
    prisma.utilisateur.count({ where }),
    prisma.utilisateur.findMany({
      where,
      skip,
      take: limit,
      include: { role: true },
      orderBy: [{ nom_fr: 'asc' }],
    }),
  ]);

  const sanitized = items.map(({ mot_de_passe: _, ...u }) => u);
  return { total, page, limit, data: sanitized };
}

export async function creerUtilisateur(etablissement_id: string, data: UtilisateurInput, acteurId: string) {
  const hashedPassword = await bcrypt.hash(data.mot_de_passe, 10);

  const utilisateur = await prisma.utilisateur.create({
    data: {
      etablissement_id,
      role_id: data.role_id ?? 'role-professeur',
      nom_fr: data.nom_fr,
      nom_ar: data.nom_ar,
      identifiant: data.identifiant,
      email: data.email,
      mot_de_passe: hashedPassword,
      langue: data.langue ?? 'fr',
      theme: data.theme ?? 'light',
      doit_changer_mdp: true, // Forcer le changement à la première connexion
    },
    include: { role: true },
  });

  await logAction(etablissement_id, acteurId, 'CREATE', 'Utilisateur', utilisateur.id, {
    identifiant: utilisateur.identifiant, role: utilisateur.role.libelle_fr,
  });

  const { mot_de_passe: _, ...result } = utilisateur;
  return result;
}

export async function modifierUtilisateur(
  id: string,
  etablissement_id: string,
  data: Partial<UtilisateurInput>,
  acteurId: string
) {
  const existing = await prisma.utilisateur.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Utilisateur introuvable');

  const updateData: Record<string, unknown> = {};
  if (data.identifiant) updateData.identifiant = data.identifiant;
  if (data.nom_fr) updateData.nom_fr = data.nom_fr;
  if (data.nom_ar) updateData.nom_ar = data.nom_ar;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.role_id) updateData.role_id = data.role_id;
  if (data.langue) updateData.langue = data.langue;
  if (data.theme) updateData.theme = data.theme;

  const utilisateur = await prisma.utilisateur.update({
    where: { id },
    data: updateData,
    include: { role: true },
  });

  await logAction(etablissement_id, acteurId, 'UPDATE', 'Utilisateur', id, { changes: updateData });

  const { mot_de_passe: _, ...result } = utilisateur;
  return result;
}

export async function supprimerUtilisateur(id: string, etablissement_id: string, acteurId: string) {
  const existing = await prisma.utilisateur.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Utilisateur introuvable');

  await logAction(etablissement_id, acteurId, 'DELETE', 'Utilisateur', id, { identifiant: existing.identifiant });
  return prisma.utilisateur.update({ where: { id }, data: { actif: false } });
}

export async function resetPassword(id: string, etablissement_id: string, data: ResetPasswordInput, acteurId: string) {
  const existing = await prisma.utilisateur.findFirst({ where: { id, etablissement_id } });
  if (!existing) throw new Error('Utilisateur introuvable');

  const hashedPassword = await bcrypt.hash(data.nouveau_mot_de_passe, 10);

  await prisma.utilisateur.update({
    where: { id },
    data: { mot_de_passe: hashedPassword, doit_changer_mdp: true },
  });

  await logAction(etablissement_id, acteurId, 'UPDATE', 'Utilisateur', id, { action: 'reset_password' });

  return { message: 'Mot de passe réinitialisé avec succès' };
}
