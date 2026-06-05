import { FastifyRequest, FastifyReply } from 'fastify';
import { login, getMe, changePassword, updateProfil, creerRefreshToken, validerRefreshToken, revoquerRefreshToken, revoquerTousTokens, CompteVerrouilleError } from './auth.service';
import { loginSchema } from './auth.schema';
import { JwtPayload } from '../../utils/jwt';
import { env, isProd } from '../../config/env';

const TOKEN_EXPIRY = env.JWT_EXPIRES_IN;

function cookieOptions(_reply: FastifyReply) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    domain: isProd ? env.COOKIE_DOMAIN : undefined,
    path: '/',
    maxAge: 24 * 60 * 60,
    signed: false,
  };
}

export async function loginHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }

  try {
    const { payload, user } = await login(parsed.data.identifiant, parsed.data.mot_de_passe);
    const token = await reply.jwtSign(payload, { expiresIn: TOKEN_EXPIRY });
    const refreshToken = await creerRefreshToken(user.id);
    reply.setCookie('daaragest_token', token, cookieOptions(reply));
    reply.setCookie('daaragest_refresh', refreshToken, { ...cookieOptions(reply), maxAge: 30 * 24 * 60 * 60 });
    // Le token n'est plus retourné dans le body : il vit uniquement dans le
    // cookie httpOnly. Aucun chemin javascript n'a besoin d'y accéder.
    return reply.send({ user });
  } catch (err) {
    if (err instanceof CompteVerrouilleError) {
      return reply.status(429).send({ error: err.message });
    }
    return reply.status(401).send({ error: (err as Error).message });
  }
}

export async function logoutHandler(request: FastifyRequest, reply: FastifyReply) {
  const refreshToken = request.cookies['daaragest_refresh'];
  if (refreshToken) await revoquerRefreshToken(refreshToken);
  reply.clearCookie('daaragest_token',   { path: '/' });
  reply.clearCookie('daaragest_refresh', { path: '/' });
  return reply.send({ message: 'Déconnecté avec succès' });
}

export async function refreshHandler(request: FastifyRequest, reply: FastifyReply) {
  const refreshToken = request.cookies['daaragest_refresh'];
  if (!refreshToken) return reply.status(401).send({ error: 'Refresh token manquant' });

  const utilisateur = await validerRefreshToken(refreshToken);
  if (!utilisateur) {
    reply.clearCookie('daaragest_token',   { path: '/' });
    reply.clearCookie('daaragest_refresh', { path: '/' });
    return reply.status(401).send({ error: 'Session expirée. Veuillez vous reconnecter.' });
  }

  const payload: JwtPayload = {
    id: utilisateur.id,
    role: utilisateur.role.libelle_fr,
    etablissement_id: utilisateur.etablissement_id,
    langue: utilisateur.langue,
    theme: utilisateur.theme,
    doit_changer_mdp: utilisateur.must_change_password,
  };

  const newToken        = await reply.jwtSign(payload, { expiresIn: TOKEN_EXPIRY });
  const newRefreshToken = await creerRefreshToken(utilisateur.id);

  reply.setCookie('daaragest_token',   newToken,        cookieOptions(reply));
  reply.setCookie('daaragest_refresh', newRefreshToken, { ...cookieOptions(reply), maxAge: 30 * 24 * 60 * 60 });

  return reply.send({ ok: true });
}

export async function getMeHandler(request: FastifyRequest, reply: FastifyReply) {
  const user = request.user as JwtPayload;
  try {
    return reply.send(await getMe(user.id));
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}

export async function changePasswordHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.user as JwtPayload;
  const { ancien_mot_de_passe, nouveau_mot_de_passe } = request.body as Record<string, string>;
  if (!ancien_mot_de_passe || !nouveau_mot_de_passe) {
    return reply.status(400).send({ error: 'Les deux champs mot de passe sont requis' });
  }
  try {
    const { payload } = await changePassword(id, ancien_mot_de_passe, nouveau_mot_de_passe);
    const token = await reply.jwtSign(payload, { expiresIn: TOKEN_EXPIRY });
    reply.setCookie('daaragest_token', token, cookieOptions(reply));
    return reply.send({ message: 'Mot de passe modifié avec succès' });
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function updateProfilHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.user as JwtPayload;
  const body = request.body as Record<string, string | null | undefined>;
  const { nom_fr, prenom_fr, email, langue, theme } = body;
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    return reply.status(400).send({ error: 'Email invalide' });
  }
  try {
    const updated = await updateProfil(id, {
      nom_fr: typeof nom_fr === 'string' ? nom_fr : undefined,
      prenom_fr: prenom_fr === undefined ? undefined : prenom_fr,
      email: email === undefined ? undefined : email,
      langue: typeof langue === 'string' ? langue : undefined,
      theme: typeof theme === 'string' ? theme : undefined,
    });
    return reply.send(updated);
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function revoquerSessionsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.user as JwtPayload;
  await revoquerTousTokens(id);
  reply.clearCookie('daaragest_token', { path: '/' });
  reply.clearCookie('daaragest_refresh', { path: '/' });
  return reply.send({ message: 'Toutes les sessions ont été révoquées' });
}
