import { FastifyRequest, FastifyReply } from 'fastify';
import { login, getMe, changePassword, updateProfil } from './auth.service';
import { loginSchema } from './auth.schema';
import { JwtPayload } from '../../utils/jwt';

export async function loginHandler(request: FastifyRequest, reply: FastifyReply) {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.errors[0].message });
  }

  try {
    const { payload, user } = await login(parsed.data.identifiant, parsed.data.mot_de_passe);
    const token = await reply.jwtSign(payload, { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' });
    return reply.send({ token, user });
  } catch (err) {
    return reply.status(401).send({ error: (err as Error).message });
  }
}

export async function logoutHandler(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send({ message: 'Déconnecté avec succès' });
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
    // Émettre un nouveau token avec doit_changer_mdp: false
    const token = await reply.jwtSign(payload, { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' });
    return reply.send({ message: 'Mot de passe modifié avec succès', token });
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}

export async function updateProfilHandler(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.user as JwtPayload;
  const { nom_fr, langue, theme } = request.body as Record<string, string>;
  try {
    const updated = await updateProfil(id, { nom_fr, langue, theme });
    return reply.send(updated);
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
}
