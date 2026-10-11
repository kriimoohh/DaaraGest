import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import { construireRapport } from './cahier.rapport';

// Rapport journalier/hebdomadaire (vraie base) : séances prévues vs renseignées, devoirs,
// séances manquantes, et périmètre du professeur.

const RUN = randomUUID().slice(0, 8);
const etabId = `rp-etab-${RUN}`, anneeId = `rp-annee-${RUN}`, filiereId = `rp-fil-${RUN}`;
const classeA = `rp-cla-${RUN}`, classeB = `rp-clb-${RUN}`, matId = `rp-mat-${RUN}`;
const userId = `rp-user-${RUN}`, persId = `rp-pers-${RUN}`;
const cren1 = `rp-c1-${RUN}`, cren2 = `rp-c2-${RUN}`, cren3 = `rp-c3-${RUN}`;
const LUNDI = '2026-03-02';

async function nettoyer() {
  await prisma.devoir.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.cahierSeance.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.creneau.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.classe.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.matiere.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.filiere.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.personnel.deleteMany({ where: { id: persId } });
  await prisma.utilisateur.deleteMany({ where: { id: userId } });
  await prisma.configNotes.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.anneeScolaire.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.etablissement.deleteMany({ where: { id: etabId } });
}

beforeAll(async () => {
  await nettoyer();
  await prisma.etablissement.create({ data: { id: etabId, nom_fr: 'École Rapport', code: `RP${RUN.slice(0, 4).toUpperCase()}` } });
  await prisma.configNotes.create({ data: { etablissement_id: etabId } });
  await prisma.anneeScolaire.create({ data: { id: anneeId, etablissement_id: etabId, libelle: '2025-2026', active: true, date_debut: new Date('2025-10-01'), date_fin: new Date('2026-07-01') } });
  await prisma.filiere.create({ data: { id: filiereId, etablissement_id: etabId, code: 'FR', nom_fr: 'Française', langue: 'fr', sens_ecriture: 'LTR' } });
  await prisma.classe.createMany({ data: [
    { id: classeA, etablissement_id: etabId, annee_scolaire_id: anneeId, nom_fr: 'CE1 A', filiere_id: filiereId },
    { id: classeB, etablissement_id: etabId, annee_scolaire_id: anneeId, nom_fr: 'CE1 B', filiere_id: filiereId },
  ] });
  await prisma.matiere.create({ data: { id: matId, etablissement_id: etabId, nom_fr: 'Lecture', filiere_id: filiereId } });
  const role = await prisma.role.upsert({ where: { libelle_fr: 'professeur' }, update: {}, create: { libelle_fr: 'professeur' } });
  await prisma.utilisateur.create({ data: { id: userId, etablissement_id: etabId, role_id: role.id, nom_fr: 'Prof', identifiant: `rp-${RUN}`, mot_de_passe: 'x' } });
  await prisma.personnel.create({ data: { id: persId, utilisateur_id: userId } });
  const cr = (id: string, classe_id: string, debut: string) => ({
    id, etablissement_id: etabId, annee_scolaire_id: anneeId, classe_id, matiere_id: matId, personnel_id: persId,
    jour: 'lundi', heure_debut: debut, heure_fin: '09:00',
  });
  await prisma.creneau.createMany({ data: [cr(cren1, classeA, '08:00'), cr(cren2, classeA, '09:00'), cr(cren3, classeB, '08:00')] });
  // Classe A : 1 des 2 créneaux renseigné + 1 devoir. Classe B : rien.
  await prisma.cahierSeance.create({ data: {
    etablissement_id: etabId, annee_scolaire_id: anneeId, classe_id: classeA, matiere_id: matId, personnel_id: persId,
    date: new Date(`${LUNDI}T00:00:00Z`), creneau_id: cren1, contenu: 'Le lion',
  } });
  await prisma.devoir.create({ data: {
    etablissement_id: etabId, annee_scolaire_id: anneeId, classe_id: classeA, matiere_id: matId, personnel_id: persId,
    donne_le: new Date(`${LUNDI}T00:00:00Z`), pour_le: new Date('2026-03-04T00:00:00Z'), consigne: 'Relire', type: 'EXERCICE',
  } });
});

afterAll(async () => { await nettoyer(); await prisma.$disconnect(); });

describe('Rapport du cahier de texte (DB réelle)', () => {
  it('journalier : prévues, renseignées, séances manquantes et devoirs par classe', async () => {
    const r = await construireRapport(etabId, { annee_scolaire_id: anneeId, periode: 'jour', date: LUNDI }, null);
    expect(r.totaux).toMatchObject({ prevus: 3, renseignes: 1, manquantes: 2, taux: 33 });
    const a = r.classes.find(c => c.classe.id === classeA)!;
    expect(a).toMatchObject({ prevus: 2, renseignes: 1, taux: 50 });
    expect(a.jours[0].seances).toHaveLength(1);
    expect(a.jours[0].devoirs).toHaveLength(1);
    expect(a.jours[0].manquantes).toHaveLength(1);
    expect(r.classes.find(c => c.classe.id === classeB)!.renseignes).toBe(0);
  });

  it('hebdomadaire : une date en milieu de semaine couvre lundi → dimanche', async () => {
    const r = await construireRapport(etabId, { annee_scolaire_id: anneeId, periode: 'semaine', date: '2026-03-05' }, null);
    expect([r.du, r.au]).toEqual(['2026-03-02', '2026-03-08']);
    expect(r.totaux.prevus).toBe(3);
  });

  it('une journée sans cours ni saisie ne liste aucune classe', async () => {
    const r = await construireRapport(etabId, { annee_scolaire_id: anneeId, periode: 'jour', date: '2026-03-03' }, null);
    expect(r.classes).toHaveLength(0);
    expect(r.totaux.taux).toBeNull();
  });

  it('périmètre professeur : seules ses classes ; classe hors périmètre → vide', async () => {
    const portee = { classe_ids: [classeA] };
    const r = await construireRapport(etabId, { annee_scolaire_id: anneeId, periode: 'jour', date: LUNDI }, portee);
    expect(r.classes.map(c => c.classe.id)).toEqual([classeA]);
    const hors = await construireRapport(etabId, { annee_scolaire_id: anneeId, periode: 'jour', date: LUNDI, classe_id: classeB }, portee);
    expect(hors.classes).toHaveLength(0);
    const aucune = await construireRapport(etabId, { annee_scolaire_id: anneeId, periode: 'jour', date: LUNDI }, { classe_ids: [] });
    expect(aucune.classes).toHaveLength(0);
  });

  it('isolation : un autre établissement ne voit rien', async () => {
    const r = await construireRapport(`autre-${RUN}`, { annee_scolaire_id: anneeId, periode: 'jour', date: LUNDI }, null);
    expect(r.classes).toHaveLength(0);
  });
});
