import { FastifyRequest, FastifyReply } from 'fastify';
import { login, getMe } from './auth.service';
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
    const data = await getMe(user.id);
    return reply.send(data);
  } catch (err) {
    return reply.status(404).send({ error: (err as Error).message });
  }
}
