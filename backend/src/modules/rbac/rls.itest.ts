import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import prisma, { contexteTenant, horsIsolation, brancherContexteTenant, definirTenant } from '../../config/database';

// Isolation des établissements PAR LA BASE (RLS PostgreSQL), en défense en profondeur : même une
// requête qui OUBLIE le filtre `etablissement_id` ne doit voir ni modifier les données d'une autre
// école dès qu'une requête HTTP authentifiée a fixé son établissement.

const RUN = randomUUID().slice(0, 6).toUpperCase();
const A = `rls-a-${RUN}`, B = `rls-b-${RUN}`;
const nA = `rls-na-${RUN}`, nB = `rls-nb-${RUN}`;
// Les requêtes Prisma sont paresseuses : elles s'exécutent quand on les attend. On les attend donc DANS
// le contexte, comme le fait un handler Fastify.
const dans = <T>(etab: string, fn: () => Promise<T>) => contexteTenant.run({ etablissement_id: etab }, async () => await fn());

beforeAll(async () => {
  await prisma.niveau.deleteMany({ where: { etablissement_id: { in: [A, B] } } });
  await prisma.etablissement.deleteMany({ where: { id: { in: [A, B] } } });
  await prisma.etablissement.createMany({ data: [
    { id: A, nom_fr: 'RLS A', code: `RA${RUN.slice(0, 4)}` },
    { id: B, nom_fr: 'RLS B', code: `RB${RUN.slice(0, 4)}` },
  ] });
  await prisma.niveau.createMany({ data: [
    { id: nA, etablissement_id: A, libelle: 'CI', ordre: 1 },
    { id: nB, etablissement_id: B, libelle: 'CI', ordre: 1 },
  ] });
});

afterEach(() => { delete process.env.RLS_ACTIF; });

afterAll(async () => {
  await prisma.niveau.deleteMany({ where: { etablissement_id: { in: [A, B] } } });
  await prisma.etablissement.deleteMany({ where: { id: { in: [A, B] } } });
  await prisma.$disconnect();
});

const ids = (rows: { id: string }[]) => rows.map(r => r.id).sort();
const tous = { where: { id: { in: [nA, nB] } } };

describe('RLS — couverture du schéma', () => {
  it('toute table portant etablissement_id a la RLS activée et une politique (+ Etablissement)', async () => {
    const manquantes = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT c.table_name FROM information_schema.columns c
      JOIN pg_tables t ON t.tablename = c.table_name AND t.schemaname = 'public'
      WHERE c.table_schema = 'public' AND c.column_name = 'etablissement_id'
        AND (NOT t.rowsecurity OR NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.tablename = c.table_name))`;
    expect(manquantes.map(m => m.table_name)).toEqual([]);
    const [etab] = await prisma.$queryRaw<{ rowsecurity: boolean }[]>`SELECT rowsecurity FROM pg_tables WHERE tablename = 'Etablissement'`;
    expect(etab.rowsecurity).toBe(true);
  });
});

describe('RLS — requêtes isolées dans le contexte d\'un établissement', () => {
  it('une lecture SANS filtre d\'établissement ne voit que son école', async () => {
    expect(ids(await dans(A, () => prisma.niveau.findMany(tous)))).toEqual([nA]);
    expect(ids(await dans(B, () => prisma.niveau.findMany(tous)))).toEqual([nB]);
    expect(await dans(A, () => prisma.niveau.findUnique({ where: { id: nB } }))).toBeNull();
    expect(await dans(A, () => prisma.etablissement.count({ where: { id: { in: [A, B] } } }))).toBe(1);
  });

  it('écrire pour une autre école est refusé ; modifier ou supprimer ses lignes est sans effet', async () => {
    await expect(dans(A, () => prisma.niveau.create({ data: { etablissement_id: B, libelle: 'CP', ordre: 2 } }))).rejects.toThrow();
    expect((await dans(A, () => prisma.niveau.updateMany({ where: { id: nB }, data: { libelle: 'piraté' } }))).count).toBe(0);
    expect((await dans(A, () => prisma.niveau.deleteMany({ where: { id: nB } }))).count).toBe(0);
    expect((await prisma.niveau.findUnique({ where: { id: nB } }))?.libelle).toBe('CI');
  });

  it('transaction longue : réglages posés en tête, lectures isolées, écritures validées', async () => {
    const id = `rls-tx-${RUN}`;
    const vus = await dans(A, () => prisma.$transaction(async (tx) => {
      await tx.niveau.create({ data: { id, etablissement_id: A, libelle: 'CP', ordre: 2 } });
      return tx.niveau.findMany({ where: { id: { in: [nA, nB, id] } } });
    }));
    expect(ids(vus)).toEqual([id, nA].sort());
    expect(await prisma.niveau.findUnique({ where: { id } })).not.toBeNull();
    await prisma.niveau.delete({ where: { id } });
    await expect(dans(A, () => prisma.$transaction(async (tx) =>
      tx.niveau.create({ data: { etablissement_id: B, libelle: 'X', ordre: 9 } })))).rejects.toThrow();
  });

  it('transaction en lot : résultats dans l\'ordre et isolés', async () => {
    const [liste, nb] = await dans(A, () => prisma.$transaction([prisma.niveau.findMany(tous), prisma.niveau.count(tous)]));
    expect(ids(liste)).toEqual([nA]);
    expect(nb).toBe(1);
  });
});

describe('RLS — hors contexte et interrupteurs', () => {
  it('sans établissement (connexion, scripts, seed) : comportement inchangé', async () => {
    expect(ids(await prisma.niveau.findMany(tous))).toEqual([nA, nB].sort());
  });
  it('horsIsolation (super-admin plateforme) voit toutes les écoles', async () => {
    expect(ids(await dans(A, () => horsIsolation(async () => await prisma.niveau.findMany(tous))))).toEqual([nA, nB].sort());
  });
  it('RLS_ACTIF=false (urgence) : isolation par la base désactivée', async () => {
    process.env.RLS_ACTIF = 'false';
    expect(ids(await dans(A, () => prisma.niveau.findMany(tous)))).toEqual([nA, nB].sort());
  });
});

describe('RLS — propagation du contexte dans Fastify', () => {
  it('l\'établissement fixé dans un preHandler s\'applique au handler, après des hooks asynchrones', async () => {
    const app = Fastify();
    brancherContexteTenant(app);
    app.addHook('onRequest', async () => { await new Promise(r => setTimeout(r, 5)); });
    app.get('/t', {
      preHandler: [async (req) => { await new Promise(r => setTimeout(r, 5)); definirTenant(String((req.query as { e: string }).e)); }],
    }, async () => ids(await prisma.niveau.findMany(tous)));
    expect((await app.inject({ url: `/t?e=${A}` })).json()).toEqual([nA]);
    expect((await app.inject({ url: `/t?e=${B}` })).json()).toEqual([nB]);
    await app.close();
  });
});
