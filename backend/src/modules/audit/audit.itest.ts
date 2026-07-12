import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import { listerAuditLogs, listerEntitesAudit } from './audit.service';

const RUN = randomUUID().slice(0, 8);
const etabId = `audit-etab-${RUN}`;

async function nettoyer() {
  await prisma.auditLog.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.etablissement.deleteMany({ where: { id: etabId } });
}

beforeAll(async () => {
  await nettoyer();
  await prisma.etablissement.create({ data: { id: etabId, nom_fr: 'Audit Test', code: `AUD${RUN.slice(0, 3).toUpperCase()}` } });
  await prisma.auditLog.createMany({
    data: [
      { etablissement_id: etabId, utilisateur_id: 'u1', action: 'CREATE', entite: 'Eleve', entite_id: 'e1', details: { matricule: 'X' } },
      { etablissement_id: etabId, utilisateur_id: 'u1', action: 'DELETE', entite: 'Eleve', entite_id: 'e1' },
      { etablissement_id: etabId, utilisateur_id: 'u2', action: 'UPDATE', entite: 'Filiere', entite_id: 'f1' },
    ],
  });
});

afterAll(async () => { await nettoyer(); await prisma.$disconnect(); });

describe('Journal d\'audit — lecture (P1)', () => {
  it('liste toutes les entrées de l\'établissement, plus récentes d\'abord', async () => {
    const res = await listerAuditLogs(etabId, {});
    expect(res.total).toBe(3);
    expect(res.data).toHaveLength(3);
  });

  it('filtre par action', async () => {
    const res = await listerAuditLogs(etabId, { action: 'DELETE' });
    expect(res.total).toBe(1);
    expect(res.data[0].entite).toBe('Eleve');
  });

  it('filtre par entité', async () => {
    const res = await listerAuditLogs(etabId, { entite: 'Filiere' });
    expect(res.total).toBe(1);
    expect(res.data[0].action).toBe('UPDATE');
  });

  it('expose les entités distinctes', async () => {
    const entites = await listerEntitesAudit(etabId);
    expect(entites.sort()).toEqual(['Eleve', 'Filiere']);
  });
});
