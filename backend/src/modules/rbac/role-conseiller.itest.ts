import { describe, it, expect, afterAll } from 'vitest';
import prisma from '../../config/database';
import { ROLES } from '../../config/roles';

// Le rôle « conseiller pédagogique » doit exister en base APRÈS les migrations (le seed de prod
// saute son exécution quand les rôles sont déjà là : seule la migration le crée en production).

afterAll(async () => { await prisma.$disconnect(); });

describe('Rôle conseiller pédagogique — base', () => {
  it('existe une seule fois, avec le libellé exact du code', async () => {
    const lignes = await prisma.role.findMany({ where: { libelle_fr: ROLES.CONSEILLER_PEDAGOGIQUE } });
    expect(lignes).toHaveLength(1);
  });
});
