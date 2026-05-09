import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { JwtPayload } from '../../utils/jwt';

export async function login(identifiant: string, mot_de_passe: string) {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { identifiant },
    include: { role: true },
  });

  if (!utilisateur || !utilisateur.actif) {
    throw new Error('Identifiants incorrects');
  }

  const valid = await bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe);
  if (!valid) {
    throw new Error('Identifiants incorrects');
  }

  await prisma.utilisateur.update({
    where: { id: utilisateur.id },
    data: { last_login: new Date() },
  });

  const payload: JwtPayload = {
    id: utilisateur.id,
    role: utilisateur.role.libelle_fr,
    etablissement_id: utilisateur.etablissement_id,
    langue: utilisateur.langue,
    theme: utilisateur.theme,
    doit_changer_mdp: utilisateur.must_change_password,
  };

  return {
    payload,
    user: {
      id: utilisateur.id,
      nom_fr: utilisateur.nom_fr,
      prenom_fr: utilisateur.prenom_fr,
      identifiant: utilisateur.identifiant,
      langue: utilisateur.langue,
      theme: utilisateur.theme,
      role: utilisateur.role.libelle_fr,
      etablissement_id: utilisateur.etablissement_id,
      must_change_password: utilisateur.must_change_password,
    },
  };
}

export async function changePassword(id: string, ancien: string, nouveau: string) {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id },
    include: { role: true },
  });
  if (!utilisateur) throw new Error('Utilisateur introuvable');
  const valid = await bcrypt.compare(ancien, utilisateur.mot_de_passe);
  if (!valid) throw new Error('Mot de passe actuel incorrect');
  if (nouveau.length < 8) throw new Error('Le nouveau mot de passe doit contenir au moins 8 caractères');
  const hash = await bcrypt.hash(nouveau, 10);
  await prisma.utilisateur.update({
    where: { id },
    data: { mot_de_passe: hash, must_change_password: false },
  });

  const payload: JwtPayload = {
    id: utilisateur.id,
    role: utilisateur.role.libelle_fr,
    etablissement_id: utilisateur.etablissement_id,
    langue: utilisateur.langue,
    theme: utilisateur.theme,
    doit_changer_mdp: false,
  };

  return { payload };
}

export async function updateProfil(id: string, data: { nom_fr?: string; langue?: string; theme?: string }) {
  return prisma.utilisateur.update({ where: { id }, data });
}

export async function getMe(id: string) {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id },
    include: { role: true, etablissement: true },
  });

  if (!utilisateur) {
    throw new Error('Utilisateur introuvable');
  }

  return {
    id: utilisateur.id,
    nom_fr: utilisateur.nom_fr,
    prenom_fr: utilisateur.prenom_fr,
    identifiant: utilisateur.identifiant,
    langue: utilisateur.langue,
    theme: utilisateur.theme,
    role: utilisateur.role.libelle_fr,
    etablissement_id: utilisateur.etablissement_id,
    doit_changer_mdp: utilisateur.must_change_password,
    etablissement: {
      id: utilisateur.etablissement.id,
      nom_fr: utilisateur.etablissement.nom_fr,
    },
  };
}
