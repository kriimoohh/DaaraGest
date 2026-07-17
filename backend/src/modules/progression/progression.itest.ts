import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import { genererProgressions, validerProgression, listerProgressions } from './progression.service';

// Le module progression n'avait AUCUN test. Ces tests couvrent les deux bugs
// corrigés par cette PR + la justification obligatoire :
//  1. fail-open : un élève sans moyenne annuelle était « admis » d'office ;
//  2. double comptage : la décision moyennait FR+AR+COMBINE ensemble.

const RUN = randomUUID().slice(0, 8);
const etabId  = `prog-etab-${RUN}`;
const anneeId = `prog-annee-${RUN}`;
const directeurId = `prog-dir-${RUN}`;

// Élève A : bilingue, a FR + AR + COMBINE annuels. Élève B : sans aucun bulletin.
const eleveA = `prog-eleve-a-${RUN}`;
const eleveB = `prog-eleve-b-${RUN}`;
const inscA = `prog-insc-a-${RUN}`;
const inscB = `prog-insc-b-${RUN}`;

async function nettoyer() {
  await prisma.progressionEleve.deleteMany({ where: { annee_scolaire_id: anneeId } });
  await prisma.bulletin.deleteMany({ where: { annee_scolaire_id: anneeId } });
  await prisma.inscription.deleteMany({ where: { annee_scolaire_id: anneeId } });
  await prisma.configNotes.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.eleve.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.anneeScolaire.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.utilisateur.deleteMany({ where: { id: directeurId } });
  await prisma.etablissement.deleteMany({ where: { id: etabId } });
}

async function seedBase(filiereDecision = 'COMBINE') {
  await prisma.etablissement.create({
    data: { id: etabId, nom_fr: 'École Progression', code: `PRG${RUN.slice(0, 3).toUpperCase()}` },
  });
  await prisma.configNotes.create({
    data: { etablissement_id: etabId, note_max: 20, nb_periodes: 3, filiere_decision: filiereDecision },
  });
  await prisma.anneeScolaire.create({
    data: {
      id: anneeId, etablissement_id: etabId, libelle: '2025-2026', active: true,
      date_debut: new Date('2025-10-01'), date_fin: new Date('2026-07-31'),
    },
  });
  await prisma.eleve.createMany({
    data: [
      { id: eleveA, etablissement_id: etabId, matricule: `PRG-A-${RUN}`, nom_fr: 'Aidara', prenom_fr: 'Awa', sexe: 'F', date_naissance: new Date('2012-01-01') },
      { id: eleveB, etablissement_id: etabId, matricule: `PRG-B-${RUN}`, nom_fr: 'Ba', prenom_fr: 'Bou', sexe: 'M', date_naissance: new Date('2012-02-02') },
    ],
  });
  await prisma.inscription.createMany({
    data: [
      { id: inscA, eleve_id: eleveA, annee_scolaire_id: anneeId, statut: 'actif' },
      { id: inscB, eleve_id: eleveB, annee_scolaire_id: anneeId, statut: 'actif' },
    ],
  });
}

// Élève A : COMBINE = 6 (échec), mais FR = 14 et AR = 16 (le double comptage
// donnait (6+14+16)/3 = 12, une décision « admis » erronée).
async function seedAnnuelsA() {
  await prisma.bulletin.createMany({
    data: [
      { eleve_id: eleveA, annee_scolaire_id: anneeId, filiere: 'FR', periode: 0, moyenne: 14, rang: 1 },
      { eleve_id: eleveA, annee_scolaire_id: anneeId, filiere: 'AR', periode: 0, moyenne: 16, rang: 1 },
      { eleve_id: eleveA, annee_scolaire_id: anneeId, filiere: 'COMBINE', periode: 0, moyenne: 6, rang: 2 },
    ],
  });
}

afterAll(async () => { await nettoyer(); await prisma.$disconnect(); });

describe('Progression — génération des décisions automatiques', () => {
  beforeAll(async () => { await nettoyer(); await seedBase('COMBINE'); await seedAnnuelsA(); });

  it('décide sur le COMBINE seul (pas la moyenne FR+AR+COMBINE)', async () => {
    await genererProgressions(etabId, anneeId);
    const progA = await prisma.progressionEleve.findFirstOrThrow({ where: { eleve_id: eleveA, annee_scolaire_id: anneeId } });
    // COMBINE = 6 < seuil 10 → redoublant. L'ancien double comptage donnait 12 → admis.
    expect(progA.decision_auto).toBe('redoublant');
    expect(progA.decision).toBe('redoublant');
  });

  it('un élève sans aucun bulletin annuel est « à examiner », jamais « admis »', async () => {
    await genererProgressions(etabId, anneeId);
    const progB = await prisma.progressionEleve.findFirstOrThrow({ where: { eleve_id: eleveB, annee_scolaire_id: anneeId } });
    expect(progB.decision_auto).toBe('a_examiner');
    expect(progB.decision).toBe('a_examiner');
  });
});

describe('Progression — filiere_decision = FR', () => {
  beforeAll(async () => { await nettoyer(); await seedBase('FR'); await seedAnnuelsA(); });

  it('décide sur la filière FR quand elle est configurée', async () => {
    await genererProgressions(etabId, anneeId);
    const progA = await prisma.progressionEleve.findFirstOrThrow({ where: { eleve_id: eleveA, annee_scolaire_id: anneeId } });
    // FR = 14 ≥ 10 → admis (alors que COMBINE aurait donné redoublant).
    expect(progA.decision_auto).toBe('admis');
    expect(progA.decision).toBe('admis');
  });
});

describe('Progression — repli mono-filière', () => {
  beforeAll(async () => {
    await nettoyer();
    await seedBase('COMBINE');
    // Élève A n'a QUE le bulletin FR (pas de COMBINE) → repli sur l'unique bulletin.
    await prisma.bulletin.create({
      data: { eleve_id: eleveA, annee_scolaire_id: anneeId, filiere: 'FR', periode: 0, moyenne: 14, rang: 1 },
    });
  });

  it('sans COMBINE mais un seul bulletin annuel → ce bulletin décide', async () => {
    await genererProgressions(etabId, anneeId);
    const progA = await prisma.progressionEleve.findFirstOrThrow({ where: { eleve_id: eleveA, annee_scolaire_id: anneeId } });
    expect(progA.decision_auto).toBe('admis'); // FR=14
    expect(progA.decision).toBe('admis');
  });

  it('listerProgressions expose la même moyenne annuelle (pas le double comptage)', async () => {
    const liste = await listerProgressions(etabId, anneeId);
    const ligneA = liste.find(p => p.eleve_id === eleveA)!;
    expect(ligneA.moyenne_annuelle).toBe(14);
  });
});

describe('Progression — validation et justification obligatoire', () => {
  beforeAll(async () => { await nettoyer(); await seedBase('COMBINE'); await seedAnnuelsA(); await genererProgressions(etabId, anneeId); });

  it('valider en suivant la proposition auto ne demande pas de justification', async () => {
    const prog = await prisma.progressionEleve.findFirstOrThrow({ where: { eleve_id: eleveA, annee_scolaire_id: anneeId } });
    // auto = redoublant ; on suit la proposition → pas de justification requise.
    const res = await validerProgression(prog.id, etabId, { decision: 'redoublant' }, directeurId);
    expect(res.validee).toBe(true);
    expect(res.decision).toBe('redoublant');
  });

  it('contredire la proposition auto SANS justification est refusé', async () => {
    // Le test précédent a validé (validee=true) ; on remet la progression à l'état
    // « non validée, auto=redoublant » pour tester le refus de contradiction.
    const prog = await prisma.progressionEleve.findFirstOrThrow({ where: { eleve_id: eleveA, annee_scolaire_id: anneeId } });
    await prisma.progressionEleve.update({ where: { id: prog.id }, data: { validee: false, decision_auto: 'redoublant' } });
    await expect(
      validerProgression(prog.id, etabId, { decision: 'admis' }, directeurId),
    ).rejects.toThrow(/justification/i);
    // Le refus ne doit rien avoir modifié en base.
    const apres = await prisma.progressionEleve.findFirstOrThrow({ where: { id: prog.id } });
    expect(apres.validee).toBe(false);
  });

  it('contredire la proposition AVEC justification est accepté', async () => {
    const prog = await prisma.progressionEleve.findFirstOrThrow({ where: { eleve_id: eleveA, annee_scolaire_id: anneeId } });
    const res = await validerProgression(prog.id, etabId, { decision: 'admis', note_directeur: 'Passage exceptionnel décidé en conseil.' }, directeurId);
    expect(res.validee).toBe(true);
    expect(res.decision).toBe('admis');
  });

  it('on ne peut jamais valider SUR « à examiner »', async () => {
    const progB = await prisma.progressionEleve.findFirstOrThrow({ where: { eleve_id: eleveB, annee_scolaire_id: anneeId } });
    await expect(
      validerProgression(progB.id, etabId, { decision: 'a_examiner' }, directeurId),
    ).rejects.toThrow(/avant de valider/i);
    const apres = await prisma.progressionEleve.findFirstOrThrow({ where: { id: progB.id } });
    expect(apres.validee).toBe(false);
  });
});
