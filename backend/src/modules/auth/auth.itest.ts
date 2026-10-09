import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { getMe, changePassword } from './auth.service';

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
