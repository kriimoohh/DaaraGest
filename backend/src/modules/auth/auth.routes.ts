import { FastifyInstance } from 'fastify';
import { loginHandler, logoutHandler, getMeHandler, changePasswordHandler, updateProfilHandler, refreshHandler } from './auth.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, loginHandler);
  fastify.post('/refresh', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, refreshHandler);
  fastify.post('/logout', { preHandler: [authMiddleware] }, logoutHandler);
  fastify.get('/me', { preHandler: [authMiddleware] }, getMeHandler);
  fastify.put('/change-password', { preHandler: [authMiddleware] }, changePasswordHandler);
  fastify.put('/profil', { preHandler: [authMiddleware] }, updateProfilHandler);
}
