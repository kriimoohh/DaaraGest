import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import type { FastifyRequest } from 'fastify';
import { getMe, changePassword, login, creerRefreshToken, validerRefreshToken, CompteVerrouilleError } from './auth.service';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { revoquerSessions } from '../../utils/sessions';
import { modifierUtilisateur, resetPassword, supprimerUtilisateur } from '../utilisateurs/utilisateurs.service';

// Test d'INTÉGRATION (DB réelle) du changement de mot de passe obligatoire.
// Régression : /auth/me n'exposait pas `must_change_password` → le front effaçait l'obligation
// juste après la connexion et le modal ne restait pas affiché (les comptes gardaient leur
// mot de passe initial, alors que l'API refusait tout le reste avec un 403 incompréhensible).

const RUN = randomUUID().slice(0, 8);
const etabId = `auth-etab-${RUN}`;
const userId = `auth-user-${RUN}`;
const MDP_INITIAL = 'Initial-Pass-2026!a';

beforeAll(async () => {
  await prisma.utilisateur.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.etablissement.deleteMany({ where: { id: etabId } });
  await prisma.etablissement.create({ data: { id: etabId, nom_fr: 'Auth Test', code: `AUT${RUN.slice(0, 3).toUpperCase()}` } });
  const role = await prisma.role.upsert({ where: { libelle_fr: 'professeur' }, update: {}, create: { libelle_fr: 'professeur' } });
  await prisma.utilisateur.create({
    data: {
      id: userId, etablissement_id: etabId, role_id: role.id, nom_fr: 'Prof', identifiant: `auth-${RUN}`,
      mot_de_passe: await bcrypt.hash(MDP_INITIAL, 10), must_change_password: true,
    },
  });
});

afterAll(async () => {
  await prisma.utilisateur.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.etablissement.deleteMany({ where: { id: etabId } });
  await prisma.$disconnect();
});

describe('Changement de mot de passe obligatoire', () => {
  it('/auth/me expose l\'obligation sous le nom utilisé par le front', async () => {
    const me = await getMe(userId);
    expect(me.must_change_password).toBe(true);
    expect(me.doit_changer_mdp).toBe(true);
  });

  it('refuse un nouveau mot de passe identique à l\'actuel', async () => {
    await expect(changePassword(userId, MDP_INITIAL, MDP_INITIAL)).rejects.toThrow('différent');
    expect((await getMe(userId)).must_change_password).toBe(true); // rien n'a changé
  });

  it('refuse un mot de passe trop simple', async () => {
    await expect(changePassword(userId, MDP_INITIAL, 'abc')).rejects.toThrow('insuffisant');
  });

  it('un vrai changement lève l\'obligation', async () => {
    await changePassword(userId, MDP_INITIAL, 'Nouveau-Pass-2026!b');
    const me = await getMe(userId);
    expect(me.must_change_password).toBe(false);
    expect(me.doit_changer_mdp).toBe(false);
  });
});

// ── Révocation des sessions (audit SenInit DG-AUTH-001) ───────────────────────
// Avant : désactiver un compte, réinitialiser son mot de passe ou changer son rôle ne coupait pas les
// jetons déjà émis (7 jours en production). Le jeton porte maintenant une version de session.
describe('Révocation des sessions', () => {
  const ADMIN = `auth-admin-${RUN}`;
  const cible = (n: string) => `auth-${n}-${RUN}`;
  let roleProf = '', rolePoint = '';

  beforeAll(async () => {
    roleProf = (await prisma.role.upsert({ where: { libelle_fr: 'professeur' }, update: {}, create: { libelle_fr: 'professeur' } })).id;
    rolePoint = (await prisma.role.upsert({ where: { libelle_fr: 'pointeur' }, update: {}, create: { libelle_fr: 'pointeur' } })).id;
    const roleAdmin = (await prisma.role.upsert({ where: { libelle_fr: 'admin' }, update: {}, create: { libelle_fr: 'admin' } })).id;
    await prisma.utilisateur.create({ data: { id: ADMIN, etablissement_id: etabId, role_id: roleAdmin, nom_fr: 'Adm', identifiant: `adm-${RUN}`, mot_de_passe: 'x' } });
    for (const n of ['a', 'b', 'c', 'd', 'e']) {
      await prisma.utilisateur.create({
        data: { id: cible(n), etablissement_id: etabId, role_id: roleProf, nom_fr: n, identifiant: `id-${n}-${RUN}`, mot_de_passe: await bcrypt.hash(MDP_INITIAL, 10) },
      });
    }
  });

  // Jeton « émis par login » : on rejoue login() pour obtenir un payload réel.
  const jeton = async (n: string) => (await login(`id-${n}-${RUN}`, MDP_INITIAL)).payload;
  const passe = async (payload: unknown, url = '/api/v1/eleves') => {
    let code = 0;
    const reply = { status(c: number) { code = c; return this; }, send() { return this; } };
    await authMiddleware({ jwtVerify: async () => undefined, user: payload, url } as unknown as FastifyRequest, reply as never);
    return code; // 0 = accepté
  };

  it('un jeton valide passe ; un jeton émis avant l\'introduction de la version (sans `tv`) passe aussi', async () => {
    const p = await jeton('a');
    expect(await passe(p)).toBe(0);
    const { tv: _tv, ...ancien } = p;
    expect(await passe(ancien)).toBe(0);
  });

  it('après révocation des sessions, l\'ancien jeton est refusé (401) — même sans `tv`', async () => {
    const p = await jeton('a');
    await revoquerSessions(cible('a'));
    expect(await passe(p)).toBe(401);
    const { tv: _tv, ...ancien } = p;
    expect(await passe(ancien)).toBe(401);
    // une nouvelle connexion repart sur la nouvelle version
    expect(await passe(await jeton('a'))).toBe(0);
  });

  it('compte désactivé : jeton refusé tout de suite et refresh token inutilisable', async () => {
    const p = await jeton('b');
    const rt = await creerRefreshToken(cible('b'), null);
    expect(await validerRefreshToken(rt)).not.toBeNull();
    await supprimerUtilisateur(cible('b'), etabId, ADMIN);
    expect(await passe(p)).toBe(401);
    expect(await validerRefreshToken(rt)).toBeNull();
  });

  it('mot de passe réinitialisé par l\'admin : ancien jeton et refresh refusés', async () => {
    const p = await jeton('c');
    const rt = await creerRefreshToken(cible('c'), null);
    await resetPassword(cible('c'), etabId, { nouveau_mot_de_passe: 'Reset-Pass-2026!c' }, ADMIN);
    expect(await passe(p)).toBe(401);
    expect(await validerRefreshToken(rt)).toBeNull();
  });

  it('changement de rôle : ancien jeton refusé (il portait l\'ancien rôle) ; un simple changement de nom ne coupe rien', async () => {
    const p = await jeton('d');
    await modifierUtilisateur(cible('d'), etabId, { nom_fr: 'Autre nom' }, ADMIN);
    expect(await passe(p)).toBe(0);
    await modifierUtilisateur(cible('d'), etabId, { role_id: rolePoint }, ADMIN);
    expect(await passe(p)).toBe(401);
  });

  it('changement de mot de passe par l\'utilisateur : autres sessions coupées, nouvelle session valide', async () => {
    const ancien = await jeton('e');
    const rt = await creerRefreshToken(cible('e'), null);
    const { payload } = await changePassword(cible('e'), MDP_INITIAL, 'Nouveau-Pass-2026!e');
    expect(await passe(ancien)).toBe(401);
    expect(await validerRefreshToken(rt)).toBeNull();
    expect(await passe(payload)).toBe(0);
  });
});

describe('Renouvellement de session — délai de grâce (deux onglets)', () => {
  const U = `auth-grace-${RUN}`;
  beforeAll(async () => {
    const role = (await prisma.role.upsert({ where: { libelle_fr: 'professeur' }, update: {}, create: { libelle_fr: 'professeur' } })).id;
    await prisma.utilisateur.create({ data: { id: U, etablissement_id: etabId, role_id: role, nom_fr: 'G', identifiant: `g-${RUN}`, mot_de_passe: 'x' } });
  });

  it('l\'ancien refresh token reste utilisable ~60 s après une rotation, puis expire', async () => {
    const ancien = await creerRefreshToken(U, null);
    const nouveau = await creerRefreshToken(U, null); // rotation faite par l'onglet 1
    // l'onglet 2 présente encore l'ancien token : il ne doit pas être refusé
    expect(await validerRefreshToken(ancien)).not.toBeNull();
    expect(await validerRefreshToken(nouveau)).not.toBeNull();
    const rt = await prisma.refreshToken.findUniqueOrThrow({ where: { token: ancien } });
    const reste = rt.expires_at.getTime() - Date.now();
    expect(reste).toBeGreaterThan(0);
    expect(reste).toBeLessThanOrEqual(61_000);
  });
});

// ── Verrouillage progressif et déverrouillage par l'administrateur (DG-AUTH-003) ─
describe('Verrouillage de compte — progressif, levé par un reset admin', () => {
  const ADM = `auth-adm2-${RUN}`, U = `auth-lock-${RUN}`;
  beforeAll(async () => {
    const roleP = (await prisma.role.upsert({ where: { libelle_fr: 'professeur' }, update: {}, create: { libelle_fr: 'professeur' } })).id;
    const roleA = (await prisma.role.upsert({ where: { libelle_fr: 'admin' }, update: {}, create: { libelle_fr: 'admin' } })).id;
    await prisma.utilisateur.create({ data: { id: ADM, etablissement_id: etabId, role_id: roleA, nom_fr: 'Adm2', identifiant: `adm2-${RUN}`, mot_de_passe: 'x' } });
    await prisma.utilisateur.create({ data: { id: U, etablissement_id: etabId, role_id: roleP, nom_fr: 'Lock', identifiant: `lock-${RUN}`, mot_de_passe: await bcrypt.hash(MDP_INITIAL, 10) } });
  });

  it('5 échecs → verrou d\'1 minute ; le compteur continue ensuite et le délai monte', async () => {
    const ident = `lock-${RUN}`;
    for (let i = 0; i < 4; i++) await expect(login(ident, 'faux')).rejects.toThrow('Identifiants incorrects');
    await expect(login(ident, 'faux')).rejects.toBeInstanceOf(CompteVerrouilleError); // 5ᵉ échec
    // même le bon mot de passe est refusé pendant le verrou
    await expect(login(ident, MDP_INITIAL)).rejects.toBeInstanceOf(CompteVerrouilleError);
    const u = await prisma.utilisateur.findUniqueOrThrow({ where: { id: U } });
    expect(u.tentatives_connexion).toBe(5); // plus remis à zéro au verrouillage
    const minutes = (u.verrouille_jusqu!.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(0.5);
    expect(minutes).toBeLessThanOrEqual(1);
    // palier suivant : 8 échecs cumulés → 5 minutes
    await prisma.utilisateur.update({ where: { id: U }, data: { tentatives_connexion: 7, verrouille_jusqu: null } });
    await expect(login(ident, 'faux')).rejects.toBeInstanceOf(CompteVerrouilleError);
    const u2 = await prisma.utilisateur.findUniqueOrThrow({ where: { id: U } });
    expect((u2.verrouille_jusqu!.getTime() - Date.now()) / 60_000).toBeGreaterThan(4);
  });

  it('un reset du mot de passe par l\'administrateur déverrouille le compte immédiatement', async () => {
    await resetPassword(U, etabId, { nouveau_mot_de_passe: 'Reset-Pass-2026!x' }, ADM);
    const u = await prisma.utilisateur.findUniqueOrThrow({ where: { id: U } });
    expect(u.verrouille_jusqu).toBeNull();
    expect(u.tentatives_connexion).toBe(0);
    await expect(login(`lock-${RUN}`, 'Reset-Pass-2026!x')).resolves.toBeDefined();
  });
});

