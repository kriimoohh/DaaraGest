import { FastifyInstance } from 'fastify';
import { loginHandler, logoutHandler, getMeHandler, changePasswordHandler, updateProfilHandler, refreshHandler, revoquerSessionsHandler } from './auth.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

export async function authRoutes(fastify: FastifyInstance) {
  // Limite par (IP, identifiant) et non par IP seule : tout un établissement sort par la même IP, le
  // personnel qui arrive en même temps ne doit pas se bloquer mutuellement (DG-AUTH-004). La clé lit le
  // corps de la requête, d'où le hook preHandler. Les ÉCHECS par IP sont plafonnés à part (echecsConnexion).
  fastify.post('/login', {
    config: {
      rateLimit: {
        hook: 'preHandler',
        max: 10,
        timeWindow: '1 minute',
        keyGenerator: (req) => {
          const id = String((req.body as { identifiant?: unknown } | undefined)?.identifiant ?? '').trim().toLowerCase().slice(0, 64);
          return `login:${req.ip}|${id}`;
        },
      },
    },
  }, loginHandler);
  fastify.post('/refresh', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, refreshHandler);
  fastify.post('/logout', { preHandler: [authMiddleware] }, logoutHandler);
  fastify.get('/me', { preHandler: [authMiddleware] }, getMeHandler);
  fastify.put('/change-password', { preHandler: [authMiddleware] }, changePasswordHandler);
  fastify.put('/profil', { preHandler: [authMiddleware] }, updateProfilHandler);
  fastify.delete('/sessions', { preHandler: [authMiddleware] }, revoquerSessionsHandler);
}
