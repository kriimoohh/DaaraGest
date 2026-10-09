import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import { creerPaiementEleve, bulkCreerPaiementEleve } from './finances.service';

// Test d'INTÉGRATION (DB réelle) : la création de paiement dépend de la séquence
// PostgreSQL seq_recu_numero, qui n'existe que si les migrations l'ont créée. Un
// test unitaire ne peut pas le voir (régression : séquence perdue au squash, 500 en prod).

const RUN = randomUUID().slice(0, 8);
const etabId = `pai-etab-${RUN}`;
const eleveId = `pai-eleve-${RUN}`;
const eleve2Id = `pai-eleve2-${RUN}`;

async function creerEleve(id: string) {
  await prisma.eleve.create({ data: { id, etablissement_id: etabId, matricule: `PAI-${id}`, nom_fr: 'Test', prenom_fr: 'Élève', sexe: 'M', date_naissance: new Date('2015-01-01') } });
}

afterAll(async () => {
  await prisma.paiementEleve.deleteMany({ where: { eleve: { etablissement_id: etabId } } });
  await prisma.eleve.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.etablissement.deleteMany({ where: { id: etabId } });
  await prisma.$disconnect();
});

describe('Paiements élèves (séquence de reçus)', () => {
  it('crée un paiement unitaire avec un numéro de reçu REC-AAAAMMJJ-NNNNNN', async () => {
    await prisma.etablissement.create({ data: { id: etabId, nom_fr: 'Pai Test', code: `PAI${RUN.slice(0, 3).toUpperCase()}` } });
    await creerEleve(eleveId);
    await creerEleve(eleve2Id);

    const p = await creerPaiementEleve(etabId, { eleve_id: eleveId, type: 'inscription', montant: 25000 }, 'acteur');
    expect(p.recu_numero).toMatch(/^REC-\d{8}-\d{6}$/);
  });

  it('crée des paiements en masse avec des reçus distincts', async () => {
    const r = await bulkCreerPaiementEleve(etabId, { eleve_ids: [eleveId, eleve2Id], type: 'mensualite', montant: 10000, mois: 10, annee: 2026 }, 'acteur');
    expect(r.count).toBe(2);
    const recus = new Set(r.paiements.map(p => p.recu_numero));
    expect(recus.size).toBe(2);
  });
});
