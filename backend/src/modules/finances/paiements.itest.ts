import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import { creerPaiementEleve, bulkCreerPaiementEleve, getDonneesRecu } from './finances.service';

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

  it('reçu : retrouve élève, classe (via l\'année active) et établissement ; refuse un autre établissement', async () => {
    const anneeId = `pai-annee-${RUN}`, filId = `pai-fil-${RUN}`, classeId = `pai-classe-${RUN}`, inscId = `pai-insc-${RUN}`;
    await prisma.anneeScolaire.create({ data: { id: anneeId, etablissement_id: etabId, libelle: 'Année courante', active: true, date_debut: new Date(Date.now() - 90 * 86_400_000), date_fin: new Date(Date.now() + 200 * 86_400_000) } });
    await prisma.filiere.create({ data: { id: filId, etablissement_id: etabId, code: 'FR', nom_fr: 'Française', langue: 'fr', sens_ecriture: 'LTR' } });
    await prisma.classe.create({ data: { id: classeId, etablissement_id: etabId, annee_scolaire_id: anneeId, nom_fr: 'CM2 A', filiere_id: filId } });
    await prisma.inscription.create({ data: { id: inscId, eleve_id: eleveId, annee_scolaire_id: anneeId, statut: 'actif' } });
    await prisma.inscriptionClasse.create({ data: { inscription_id: inscId, filiere_id: filId, classe_id: classeId } });

    const p = await creerPaiementEleve(etabId, { eleve_id: eleveId, type: 'inscription', montant: 30000 }, 'acteur');
    const d = await getDonneesRecu(p.id, etabId);
    expect(d.inscription?.classes.map(c => c.classe.nom_fr)).toEqual(['CM2 A']);
    expect(d.etab?.nom_fr).toBe('Pai Test');
    await expect(getDonneesRecu(p.id, 'autre-etablissement')).rejects.toThrow('Paiement introuvable');

    await prisma.inscriptionClasse.deleteMany({ where: { inscription_id: inscId } });
    await prisma.inscription.deleteMany({ where: { id: inscId } });
    await prisma.classe.deleteMany({ where: { id: classeId } });
    await prisma.filiere.deleteMany({ where: { id: filId } });
    await prisma.anneeScolaire.deleteMany({ where: { id: anneeId } });
  });
});
