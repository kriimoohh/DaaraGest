import { FastifyInstance } from 'fastify';
import { loginHandler, logoutHandler, getMeHandler } from './auth.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', loginHandler);
  fastify.post('/logout', { preHandler: [authMiddleware] }, logoutHandler);
  fastify.get('/me', { preHandler: [authMiddleware] }, getMeHandler);
}
