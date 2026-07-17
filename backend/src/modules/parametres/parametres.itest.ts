import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import { updateConfigNotes, getConfigNotes } from './parametres.service';

// Couvre la validation serveur de filiere_decision ajoutée avec le module
// Progression : un code de filière périmé ferait basculer les élèves multi-
// filières en « à examiner » sans signal, donc on le refuse à l'écriture.

const RUN = randomUUID().slice(0, 8);
const etabId    = `param-etab-${RUN}`;
const filiereFr = `param-fil-fr-${RUN}`;
const filiereAr = `param-fil-ar-${RUN}`;

async function nettoyer() {
  await prisma.configNotes.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.filiere.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.etablissement.deleteMany({ where: { id: etabId } });
}

beforeAll(async () => {
  await nettoyer();
  await prisma.etablissement.create({ data: { id: etabId, nom_fr: 'École Param', code: `PAR${RUN.slice(0, 3).toUpperCase()}` } });
  await prisma.filiere.createMany({
    data: [
      { id: filiereFr, etablissement_id: etabId, code: 'FR', nom_fr: 'Française', langue: 'fr', sens_ecriture: 'LTR', actif: true },
      { id: filiereAr, etablissement_id: etabId, code: 'AR', nom_fr: 'Arabe', langue: 'ar', sens_ecriture: 'RTL', actif: false },
    ],
  });
});

afterAll(async () => { await nettoyer(); await prisma.$disconnect(); });

describe('updateConfigNotes — validation de filiere_decision', () => {
  it("accepte 'COMBINE'", async () => {
    await updateConfigNotes(etabId, { filiere_decision: 'COMBINE' });
    const cfg = await getConfigNotes(etabId) as { filiere_decision?: string };
    expect(cfg.filiere_decision).toBe('COMBINE');
  });

  it('accepte le code d’une filière active', async () => {
    await updateConfigNotes(etabId, { filiere_decision: 'FR' });
    const cfg = await getConfigNotes(etabId) as { filiere_decision?: string };
    expect(cfg.filiere_decision).toBe('FR');
  });

  it('refuse une filière désactivée', async () => {
    await expect(updateConfigNotes(etabId, { filiere_decision: 'AR' })).rejects.toThrow(/introuvable ou désactivée/i);
  });

  it('refuse un code inexistant', async () => {
    await expect(updateConfigNotes(etabId, { filiere_decision: 'ZZ' })).rejects.toThrow(/introuvable ou désactivée/i);
  });
});
