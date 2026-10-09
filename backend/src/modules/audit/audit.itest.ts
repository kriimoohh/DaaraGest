import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import { listerAuditLogs, listerEntitesAudit } from './audit.service';
import { logAction } from '../../utils/audit';

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

describe('Journal d\'audit — description et normalisation', () => {
  const etab2 = `audit2-etab-${RUN}`;
  beforeAll(async () => {
    await prisma.auditLog.deleteMany({ where: { etablissement_id: etab2 } });
    await prisma.etablissement.deleteMany({ where: { id: etab2 } });
    await prisma.etablissement.create({ data: { id: etab2, nom_fr: 'Audit2', code: `AU2${RUN.slice(0, 3).toUpperCase()}` } });
  });
  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { etablissement_id: etab2 } });
    await prisma.etablissement.deleteMany({ where: { id: etab2 } });
  });

  it('logAction calcule et stocke une description FR lisible', async () => {
    await logAction(etab2, 'u1', 'PASSWORD_RESET', 'Utilisateur', 'user-9', { identifiant: 'fdiop' });
    const row = await prisma.auditLog.findFirstOrThrow({ where: { etablissement_id: etab2, entite_id: 'user-9' } });
    expect(row.description).toBe('Réinitialisation du mot de passe — fdiop');
  });

  it('une action sémantique est filtrable telle quelle', async () => {
    const res = await listerAuditLogs(etab2, { action: 'PASSWORD_RESET' });
    expect(res.total).toBe(1);
    expect(res.data[0].action).toBe('PASSWORD_RESET');
    expect(res.data[0].resume).toBe('fdiop');
  });

  it('une ancienne ligne (UPDATE + details.action) est normalisée à la lecture', async () => {
    // Ligne écrite « à l'ancienne », sans description et sans action sémantique.
    await prisma.auditLog.create({
      data: { etablissement_id: etab2, utilisateur_id: 'u1', action: 'UPDATE', entite: 'Utilisateur', entite_id: 'user-old', details: { action: 'reset_password', identifiant: 'ancien' } },
    });
    const res = await listerAuditLogs(etab2, {});
    const ligne = res.data.find(d => d.entite_id === 'user-old')!;
    // L'action remonte en PASSWORD_RESET et une description est recalculée à la volée.
    expect(ligne.action).toBe('PASSWORD_RESET');
    expect(ligne.description).toContain('Réinitialisation du mot de passe');
  });
});

describe('Journal d\'audit — phrases lisibles (noms résolus en base)', () => {
  const etab3 = `audit3-etab-${RUN}`;
  const eleveId = `audit3-eleve-${RUN}`;
  const payId = `audit3-pay-${RUN}`;
  beforeAll(async () => {
    await prisma.auditLog.deleteMany({ where: { etablissement_id: etab3 } });
    await prisma.paiementEleve.deleteMany({ where: { eleve_id: eleveId } });
    await prisma.eleve.deleteMany({ where: { etablissement_id: etab3 } });
    await prisma.etablissement.deleteMany({ where: { id: etab3 } });
    await prisma.etablissement.create({ data: { id: etab3, nom_fr: 'Audit3', code: `AU3${RUN.slice(0, 3).toUpperCase()}` } });
    await prisma.eleve.create({ data: { id: eleveId, etablissement_id: etab3, matricule: `A3-${RUN}`, nom_fr: 'Sow', prenom_fr: 'Sira', sexe: 'F', date_naissance: new Date('2014-01-01') } });
    await prisma.paiementEleve.create({ data: { id: payId, eleve_id: eleveId, type: 'mensualite', montant: 15000, recu_numero: 'REC-T-1' } });
    await prisma.auditLog.createMany({ data: [
      { etablissement_id: etab3, utilisateur_id: 'u', action: 'UPDATE', entite: 'PaiementEleve', entite_id: payId, details: { changes: { montant: 20000 } } },
      { etablissement_id: etab3, utilisateur_id: 'u', action: 'DELETE', entite: 'PaiementEleve', entite_id: 'supprime', details: { eleve_id: 'eleve-disparu', montant: '5000', recu: 'REC-X' } },
    ] });
  });
  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { etablissement_id: etab3 } });
    await prisma.paiementEleve.deleteMany({ where: { eleve_id: eleveId } });
    await prisma.eleve.deleteMany({ where: { etablissement_id: etab3 } });
    await prisma.etablissement.deleteMany({ where: { id: etab3 } });
  });

  it('retrouve le nom de l\'élève et le reçu à partir de l\'id du paiement', async () => {
    const res = await listerAuditLogs(etab3, { action: 'UPDATE' });
    expect(res.data[0].phrase).toEqual({ cle: 'UPDATE.PaiementEleve', params: { eleve: 'Sira Sow', recu: 'REC-T-1', montant: 20000, type: 'mensualite' } });
  });
  it('ne renvoie jamais d\'identifiant technique : élève supprimé depuis → nom null', async () => {
    const res = await listerAuditLogs(etab3, { action: 'DELETE' });
    expect(res.data[0].phrase.params.eleve).toBeNull();
    expect(JSON.stringify(res.data[0])).not.toContain('eleve-disparu');
    expect('details' in res.data[0]).toBe(false);
  });
});

