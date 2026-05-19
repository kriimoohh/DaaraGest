/**
 * Tests d'intégration HTTP — Fastify inject + Prisma mocké via vi.mock
 *
 * Ces tests exercent la couche HTTP complète (routes → middlewares → controllers)
 * sans base de données réelle. Les services sont mockés au niveau du module Prisma.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';

// ── Mock Prisma ────────────────────────────────────────────────────────────────
vi.mock('../../config/database', () => ({
  default: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    utilisateur: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    role: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'r1', libelle_fr: 'admin' },
        { id: 'r2', libelle_fr: 'professeur' },
      ]),
    },
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const JWT_SECRET = 'test-secret-min-32-chars-for-hmac-256';

function makePayload(role: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-uuid-1',
    role,
    etablissement_id: 'etab-uuid-1',
    langue: 'fr',
    theme: 'light',
    doit_changer_mdp: false,
    ...overrides,
  };
}

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(cookie);
  await app.register(jwt, { secret: JWT_SECRET, cookie: { cookieName: 'daaragest_token', signed: false } });
  await app.register(rateLimit, { global: true, max: 1000, timeWindow: '1 minute' });

  // Import routes dynamiquement (après le mock Prisma)
  const { authRoutes } = await import('../auth/auth.routes');
  const { utilisateurRoutes } = await import('../utilisateurs/utilisateurs.routes');
  const { eleveRoutes } = await import('../eleves/eleves.routes');
  const { noteRoutes } = await import('../notes/notes.routes');
  const { financesRoutes } = await import('../finances/finances.routes');
  const { absencesRoutes } = await import('../absences/absences.routes');

  await app.register(async (api) => {
    await api.register(authRoutes, { prefix: '/auth' });
    await api.register(utilisateurRoutes, { prefix: '/utilisateurs' });
    await api.register(eleveRoutes, { prefix: '/eleves' });
    await api.register(noteRoutes, { prefix: '/notes' });
    await api.register(financesRoutes, { prefix: '/finances' });
    await api.register(absencesRoutes, { prefix: '/absences' });
  }, { prefix: '/api/v1' });

  return app;
}

async function signToken(app: Fastify.FastifyInstance, payload: object): Promise<string> {
  return app.jwt.sign(payload, { expiresIn: '1h' });
}

// ════════════════════════════════════════════════════════════════════════════
// TESTS AUTH
// ════════════════════════════════════════════════════════════════════════════

describe('Intégration — Auth', () => {
  it('POST /auth/login sans body → 400', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', body: {} });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('POST /auth/login identifiant vide → 400', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      body: { identifiant: '', mot_de_passe: 'test' },
    });
    expect(res.statusCode).toBe(400);
    const json = res.json();
    expect(json).toHaveProperty('error');
    await app.close();
  });

  it('GET /auth/me sans token → 401', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('GET /auth/me avec token invalide → 401', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'GET', url: '/api/v1/auth/me',
      headers: { Authorization: 'Bearer invalid.token.here' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS must_change_password GATE
// ════════════════════════════════════════════════════════════════════════════

describe('Intégration — must_change_password gate', () => {
  it('route protégée avec doit_changer_mdp=true → 403', async () => {
    const app = await buildApp();
    const token = await signToken(app, makePayload('admin', { doit_changer_mdp: true }));
    const res = await app.inject({
      method: 'GET', url: '/api/v1/utilisateurs/roles',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    const json = res.json();
    expect(json.doit_changer_mdp).toBe(true);
    await app.close();
  });

  it('GET /auth/me avec doit_changer_mdp=true → non bloqué (route exemptée)', async () => {
    const app = await buildApp();
    // /auth/me est dans la liste des routes exemptées — même si le mock ne retourne
    // pas d'utilisateur (provoquant 404), on vérifie qu'on ne reçoit PAS 403
    const token = await signToken(app, makePayload('admin', { doit_changer_mdp: true }));
    const res = await app.inject({
      method: 'GET', url: '/api/v1/auth/me',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).not.toBe(403);
    await app.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS RBAC HTTP
// ════════════════════════════════════════════════════════════════════════════

describe('Intégration — RBAC : Utilisateurs (admin only)', () => {
  it('GET /utilisateurs sans token → 401', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/utilisateurs' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('GET /utilisateurs avec token professeur → 403', async () => {
    const app = await buildApp();
    const token = await signToken(app, makePayload('professeur'));
    const res = await app.inject({
      method: 'GET', url: '/api/v1/utilisateurs',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('GET /utilisateurs avec token directeur → 403', async () => {
    const app = await buildApp();
    const token = await signToken(app, makePayload('directeur'));
    const res = await app.inject({
      method: 'GET', url: '/api/v1/utilisateurs',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('GET /utilisateurs avec token gestionnaire → 403', async () => {
    const app = await buildApp();
    const token = await signToken(app, makePayload('gestionnaire'));
    const res = await app.inject({
      method: 'GET', url: '/api/v1/utilisateurs',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('GET /utilisateurs/roles avec token professeur → 200 (public aux auth)', async () => {
    const app = await buildApp();
    const token = await signToken(app, makePayload('professeur'));
    const res = await app.inject({
      method: 'GET', url: '/api/v1/utilisateurs/roles',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

describe('Intégration — RBAC : Élèves', () => {
  it('GET /eleves sans token → 401', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/eleves' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('POST /eleves avec token pointeur → 403 (lecture seule pour pointeur)', async () => {
    const app = await buildApp();
    const token = await signToken(app, makePayload('pointeur'));
    const res = await app.inject({
      method: 'POST', url: '/api/v1/eleves',
      headers: { Authorization: `Bearer ${token}` },
      body: { nom_fr: 'Test', prenom_fr: 'Test', date_naissance: '2010-01-01', sexe: 'M' },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('DELETE /eleves/:id avec token gestionnaire → 403', async () => {
    const app = await buildApp();
    const token = await signToken(app, makePayload('gestionnaire'));
    const res = await app.inject({
      method: 'DELETE', url: '/api/v1/eleves/some-uuid',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

describe('Intégration — RBAC : Finances', () => {
  it('GET /finances/paiements-eleves avec token pointeur → 403', async () => {
    const app = await buildApp();
    const token = await signToken(app, makePayload('pointeur'));
    const res = await app.inject({
      method: 'GET', url: '/api/v1/finances/paiements-eleves',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('GET /finances/paiements-eleves avec token professeur → 403', async () => {
    const app = await buildApp();
    const token = await signToken(app, makePayload('professeur'));
    const res = await app.inject({
      method: 'GET', url: '/api/v1/finances/paiements-eleves',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('PUT /finances/paiements-eleves/:id avec token agent de scolarité → 403', async () => {
    const app = await buildApp();
    const token = await signToken(app, makePayload('agent de scolarité'));
    const res = await app.inject({
      method: 'PUT', url: '/api/v1/finances/paiements-eleves/some-id',
      headers: { Authorization: `Bearer ${token}` },
      body: { montant: 7500 },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

describe('Intégration — RBAC : Notes', () => {
  it('GET /notes avec token agent de scolarité → 403', async () => {
    const app = await buildApp();
    const token = await signToken(app, makePayload('agent de scolarité'));
    const res = await app.inject({
      method: 'GET', url: '/api/v1/notes',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('GET /notes avec token pointeur → 403', async () => {
    const app = await buildApp();
    const token = await signToken(app, makePayload('pointeur'));
    const res = await app.inject({
      method: 'GET', url: '/api/v1/notes',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

describe('Intégration — RBAC : Absences', () => {
  it('GET /absences sans token → 401', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/absences' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('POST /absences avec token pointeur → pas 403 (pointeur a accès PRESENCE)', async () => {
    const app = await buildApp();
    const token = await signToken(app, makePayload('pointeur'));
    const res = await app.inject({
      method: 'POST', url: '/api/v1/absences',
      headers: { Authorization: `Bearer ${token}` },
      body: {},
    });
    // Le pointeur a accès au groupe PRESENCE — la requête passe le middleware RBAC
    // Elle peut échouer pour d'autres raisons (validation, DB) mais pas 401/403
    expect(res.statusCode).not.toBe(401);
    expect(res.statusCode).not.toBe(403);
    await app.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS VALIDATION HTTP
// ════════════════════════════════════════════════════════════════════════════

describe('Intégration — Validation : Création utilisateur', () => {
  it('POST /utilisateurs avec mot de passe trop court → 400', async () => {
    const app = await buildApp();
    const token = await signToken(app, makePayload('admin'));
    const res = await app.inject({
      method: 'POST', url: '/api/v1/utilisateurs',
      headers: { Authorization: `Bearer ${token}` },
      body: { nom_fr: 'Test', identifiant: 'test.user', mot_de_passe: 'short' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('POST /utilisateurs avec identifiant invalide (caractères spéciaux) → 400', async () => {
    const app = await buildApp();
    const token = await signToken(app, makePayload('admin'));
    const res = await app.inject({
      method: 'POST', url: '/api/v1/utilisateurs',
      headers: { Authorization: `Bearer ${token}` },
      body: { nom_fr: 'Test', identifiant: 'user@bad!', mot_de_passe: 'Password123!' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('POST /utilisateurs avec identifiant valide mais trop court → 400', async () => {
    const app = await buildApp();
    const token = await signToken(app, makePayload('admin'));
    const res = await app.inject({
      method: 'POST', url: '/api/v1/utilisateurs',
      headers: { Authorization: `Bearer ${token}` },
      body: { nom_fr: 'Test', identifiant: 'ab', mot_de_passe: 'Password123!' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TESTS LOGIN (rate limiting awareness)
// ════════════════════════════════════════════════════════════════════════════

describe('Intégration — Login body invalide', () => {
  it('POST login avec identifiant trop long (>50 chars) → 400', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      body: { identifiant: 'a'.repeat(51), mot_de_passe: 'test' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('POST login avec payload non-JSON → 400', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST', url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: 'pas du json',
    });
    expect([400, 415]).toContain(res.statusCode);
    await app.close();
  });
});
