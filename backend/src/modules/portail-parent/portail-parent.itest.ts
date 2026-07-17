import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import { genererToken, regenererToken, revoquerToken, getPortailData } from './portail-parent.service';

// Le module portail-parent n'avait aucun test. Couvre la faille corrigée par
// cette PR : un lien qui a fuité était irrévocable/irrémédiable depuis l'appli.
// - genererToken RÉUTILISE le token (ne casse pas un lien valide en le ré-affichant) ;
// - regenererToken émet un NOUVEAU token → l'ancien lien meurt aussitôt ;
// - revoquerToken désactive le lien ;
// - les 3 opérations écrivent une trace d'audit.

const RUN = randomUUID().slice(0, 8);
const etabId  = `pp-etab-${RUN}`;
const eleveId = `pp-eleve-${RUN}`;
const acteur  = `pp-acteur-${RUN}`;

async function nettoyer() {
  await prisma.auditLog.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.portailParentToken.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.eleve.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.etablissement.deleteMany({ where: { id: etabId } });
}

beforeAll(async () => {
  await nettoyer();
  await prisma.etablissement.create({ data: { id: etabId, nom_fr: 'École Portail', code: `PP${RUN.slice(0, 4).toUpperCase()}` } });
  await prisma.eleve.create({
    data: { id: eleveId, etablissement_id: etabId, matricule: `PP-E-${RUN}`, nom_fr: 'Sow', prenom_fr: 'Sira', sexe: 'F', date_naissance: new Date('2012-01-01') },
  });
});

afterAll(async () => { await nettoyer(); await prisma.$disconnect(); });

describe('Portail parent — génération et rotation', () => {
  it('genererToken réutilise le même token à la ré-invocation (ne casse pas un lien valide)', async () => {
    const t1 = await genererToken(etabId, eleveId, acteur);
    const t2 = await genererToken(etabId, eleveId, acteur);
    expect(t2.token).toBe(t1.token);
    expect(t2.id).toBe(t1.id);
  });

  it('regenererToken émet un NOUVEAU token et tue l’ancien lien', async () => {
    const avant = await prisma.portailParentToken.findFirstOrThrow({ where: { etablissement_id: etabId, eleve_id: eleveId } });
    const ancienToken = avant.token;

    const apres = await regenererToken(etabId, eleveId, acteur);
    expect(apres.token).not.toBe(ancienToken);
    expect(apres.id).toBe(avant.id); // même enregistrement, token tourné

    // L'ancien lien ne correspond plus à aucun enregistrement → accès refusé.
    await expect(getPortailData(ancienToken)).rejects.toThrow(/invalide|désactivé/i);
  });

  it('regenererToken sur un élève sans lien échoue proprement', async () => {
    const autre = `pp-eleve2-${RUN}`;
    await prisma.eleve.create({
      data: { id: autre, etablissement_id: etabId, matricule: `PP-E2-${RUN}`, nom_fr: 'Ka', prenom_fr: 'Kadi', sexe: 'F', date_naissance: new Date('2012-02-02') },
    });
    await expect(regenererToken(etabId, autre, acteur)).rejects.toThrow(/aucun lien/i);
  });
});

describe('Portail parent — révocation', () => {
  it('revoquerToken désactive le lien (accès refusé)', async () => {
    const rec = await prisma.portailParentToken.findFirstOrThrow({ where: { etablissement_id: etabId, eleve_id: eleveId } });
    await revoquerToken(rec.token, etabId, acteur);
    const apres = await prisma.portailParentToken.findFirstOrThrow({ where: { id: rec.id } });
    expect(apres.actif).toBe(false);
    await expect(getPortailData(rec.token)).rejects.toThrow(/invalide|désactivé/i);
  });
});

describe('Portail parent — audit', () => {
  it('génération, rotation et révocation laissent une trace d’audit', async () => {
    const gen = await prisma.auditLog.count({ where: { etablissement_id: etabId, action: 'PORTAIL_GENERATE' } });
    const rev = await prisma.auditLog.count({ where: { etablissement_id: etabId, action: 'PORTAIL_REVOKE' } });
    // genererToken ×2 (dont 1 réutilisation, mais chaque appel audite) + regenererToken ×1.
    expect(gen).toBeGreaterThanOrEqual(3);
    expect(rev).toBeGreaterThanOrEqual(1);
  });
});
