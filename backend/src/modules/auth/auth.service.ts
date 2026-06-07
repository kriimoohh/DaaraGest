import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { JwtPayload } from '../../utils/jwt';
import { assertMotDePasseValide } from '../../utils/passwordPolicy';
import { NotFoundError } from '../../utils/errors';

// ─── Verrouillage anti brute-force ──────────────────────────────────────────────
// Persisté en base (et non en mémoire process) pour rester efficace même quand
// le backend tourne en plusieurs réplicas derrière le proxy Railway : le store
// mémoire du rate-limit s'éparpille alors sur plusieurs buckets et ne plafonne
// jamais réellement les tentatives. Le compteur en base est partagé par tous.
export const MAX_TENTATIVES = 5;
export const DUREE_VERROU_MS = 15 * 60 * 1000;

export class CompteVerrouilleError extends Error {
  constructor(public minutesRestantes: number) {
    super('Trop de tentatives de connexion. Réessayez dans quelques minutes.');
    this.name = 'CompteVerrouilleError';
  }
}

/** Le compte est-il verrouillé à l'instant `maintenant` ? */
export function estVerrouille(verrouille_jusqu: Date | null, maintenant: Date = new Date()): boolean {
  return verrouille_jusqu !== null && verrouille_jusqu.getTime() > maintenant.getTime();
}

/** Date de fin de verrou si le seuil est atteint après cet échec, sinon null. */
export function calculerVerrou(tentativesApresEchec: number, maintenant: Date = new Date()): Date | null {
  return tentativesApresEchec >= MAX_TENTATIVES ? new Date(maintenant.getTime() + DUREE_VERROU_MS) : null;
}

export async function login(identifiant: string, mot_de_passe: string) {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { identifiant },
    include: { role: true },
  });

  if (!utilisateur || !utilisateur.actif) {
    throw new Error('Identifiants incorrects');
  }

  if (estVerrouille(utilisateur.verrouille_jusqu)) {
    const minutes = Math.ceil((utilisateur.verrouille_jusqu!.getTime() - Date.now()) / 60000);
    throw new CompteVerrouilleError(minutes);
  }

  const valid = await bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe);
  if (!valid) {
    const tentatives = utilisateur.tentatives_connexion + 1;
    const verrou = calculerVerrou(tentatives);
    await prisma.utilisateur.update({
      where: { id: utilisateur.id },
      // Au déclenchement du verrou on repart de zéro : la fenêtre de temps
      // (verrouille_jusqu) prend le relais comme garde-fou.
      data: verrou
        ? { tentatives_connexion: 0, verrouille_jusqu: verrou }
        : { tentatives_connexion: tentatives },
    });
    if (verrou) throw new CompteVerrouilleError(Math.ceil(DUREE_VERROU_MS / 60000));
    throw new Error('Identifiants incorrects');
  }

  await prisma.utilisateur.update({
    where: { id: utilisateur.id },
    data: { last_login: new Date(), tentatives_connexion: 0, verrouille_jusqu: null },
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
  if (!utilisateur) throw new NotFoundError('Utilisateur introuvable');
  const valid = await bcrypt.compare(ancien, utilisateur.mot_de_passe);
  if (!valid) throw new Error('Mot de passe actuel incorrect');
  assertMotDePasseValide(nouveau);
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

export async function updateProfil(
  id: string,
  data: { nom_fr?: string; prenom_fr?: string | null; email?: string | null; langue?: string; theme?: string },
) {
  const updateData: Record<string, unknown> = {};
  if (data.nom_fr !== undefined && data.nom_fr.trim()) updateData.nom_fr = data.nom_fr.trim();
  if (data.prenom_fr !== undefined) updateData.prenom_fr = data.prenom_fr || null;
  if (data.email !== undefined) updateData.email = data.email || null;
  if (data.langue) updateData.langue = data.langue;
  if (data.theme)  updateData.theme  = data.theme;
  return prisma.utilisateur.update({ where: { id }, data: updateData });
}

// ─── Refresh token ────────────────────────────────────────────────────────────

const REFRESH_EXPIRY_DAYS = 30;

export async function creerRefreshToken(
  utilisateur_id: string,
  device_id?: string | null,
): Promise<string> {
  // Rotation : ne révoquer que les tokens actifs du MÊME appareil (multi-device).
  await prisma.refreshToken.updateMany({
    where: { utilisateur_id, device_id: device_id ?? null, revoked: false },
    data: { revoked: true },
  });

  const expires_at = new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const rt = await prisma.refreshToken.create({
    data: { utilisateur_id, device_id: device_id ?? null, expires_at },
  });
  return rt.token;
}

export async function validerRefreshToken(token: string) {
  const rt = await prisma.refreshToken.findUnique({
    where: { token },
    include: { utilisateur: { include: { role: true } } },
  });
  if (!rt || rt.revoked || rt.expires_at < new Date()) return null;
  // On renvoie le token complet (device_id inclus) pour rotation par appareil.
  return rt;
}

export async function revoquerRefreshToken(token: string) {
  await prisma.refreshToken.updateMany({ where: { token }, data: { revoked: true } });
}

export async function revoquerTousTokens(utilisateur_id: string) {
  await prisma.refreshToken.updateMany({ where: { utilisateur_id }, data: { revoked: true } });
}

export async function getMe(id: string) {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id },
    include: { role: true, etablissement: true },
  });

  if (!utilisateur) {
    throw new NotFoundError('Utilisateur introuvable');
  }

  return {
    id: utilisateur.id,
    nom_fr: utilisateur.nom_fr,
    prenom_fr: utilisateur.prenom_fr,
    email: utilisateur.email,
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
