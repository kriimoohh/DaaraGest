import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import { apercuResultatsClasse, rapportResultatsClasse } from './rapports.service';
import { getBulletin, genererBulletins } from '../bulletins/bulletins.service';

// Le module rapports n'avait AUCUN test. Ces tests couvrent la divergence
// bulletin ↔ rapport corrigée par cette PR :
//   1. les rapports rendaient la moyenne sur la base CANONIQUE (établissement),
//      alors que le bulletin la re-scale sur l'échelle du NIVEAU ;
//   2. les rapports lisaient les mentions PAR DÉFAUT de l'établissement, alors
//      que le bulletin résout celles de la (filière, niveau).
// Un même élève pouvait donc afficher 15.25 « Bien » sur le rapport et 7.63
// « Excellent CM1 » sur son bulletin.

const RUN = randomUUID().slice(0, 8);
const etabId    = `rap-etab-${RUN}`;
const anneeId   = `rap-annee-${RUN}`;
const filiereId = `rap-fil-${RUN}`;
const niveauId  = `rap-niv-${RUN}`;
const classeId  = `rap-classe-${RUN}`;
const matId     = `rap-mat-${RUN}`;
const eleveId   = `rap-eleve-${RUN}`;
const inscId    = `rap-insc-${RUN}`;

async function nettoyer() {
  await prisma.bulletin.deleteMany({ where: { annee_scolaire_id: anneeId } });
  await prisma.note.deleteMany({ where: { annee_scolaire_id: anneeId } });
  await prisma.inscriptionClasse.deleteMany({ where: { inscription: { annee_scolaire_id: anneeId } } });
  await prisma.inscription.deleteMany({ where: { annee_scolaire_id: anneeId } });
  await prisma.classeMatiere.deleteMany({ where: { classe_id: classeId } });
  await prisma.classe.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.matiere.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.mention.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.niveau.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.filiere.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.eleve.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.configNotes.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.anneeScolaire.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.etablissement.deleteMany({ where: { id: etabId } });
}

beforeAll(async () => {
  await nettoyer();

  await prisma.etablissement.create({
    data: { id: etabId, nom_fr: 'École Rapports', code: `RAP${RUN.slice(0, 3).toUpperCase()}` },
  });
  // Établissement en /20 …
  await prisma.configNotes.create({ data: { etablissement_id: etabId, note_max: 20, nb_periodes: 3 } });
  await prisma.anneeScolaire.create({
    data: {
      id: anneeId, etablissement_id: etabId, libelle: '2025-2026', active: true,
      date_debut: new Date('2025-10-01'), date_fin: new Date('2026-07-31'),
    },
  });
  await prisma.filiere.create({
    data: { id: filiereId, etablissement_id: etabId, code: 'FR', nom_fr: 'Filière française', langue: 'fr', sens_ecriture: 'LTR' },
  });
  // … mais un NIVEAU en /10 : c'est lui qui pilote l'échelle d'affichage.
  await prisma.niveau.create({
    data: { id: niveauId, etablissement_id: etabId, libelle: 'CM1', ordre: 1, note_max: 10 },
  });

  // Mentions PAR DÉFAUT de l'établissement (seuils sur la base /20).
  await prisma.mention.createMany({
    data: [
      { etablissement_id: etabId, libelle_fr: 'Bien etab', seuil_min: 14, ordre: 2 },
      { etablissement_id: etabId, libelle_fr: 'Passable etab', seuil_min: 10, ordre: 1 },
      { etablissement_id: etabId, libelle_fr: 'Insuffisant etab', seuil_min: 0, ordre: 0 },
    ],
  });
  // Mentions SPÉCIFIQUES au niveau CM1 — celles que le bulletin résout et que les
  // rapports ignoraient. Libellés distincts pour lever toute ambiguïté.
  await prisma.mention.createMany({
    data: [
      { etablissement_id: etabId, niveau_id: niveauId, libelle_fr: 'Excellent CM1', seuil_min: 14, ordre: 2 },
      { etablissement_id: etabId, niveau_id: niveauId, libelle_fr: 'Correct CM1', seuil_min: 10, ordre: 1 },
      { etablissement_id: etabId, niveau_id: niveauId, libelle_fr: 'Faible CM1', seuil_min: 0, ordre: 0 },
    ],
  });

  await prisma.classe.create({
    data: { id: classeId, etablissement_id: etabId, annee_scolaire_id: anneeId, nom_fr: 'CM1 A', filiere_id: filiereId, niveau_id: niveauId },
  });
  await prisma.matiere.create({
    data: { id: matId, etablissement_id: etabId, nom_fr: 'Mathématiques', filiere_id: filiereId, coeff_defaut: 1, ordre_bulletin: 1 },
  });
  await prisma.classeMatiere.create({ data: { classe_id: classeId, matiere_id: matId } });

  await prisma.eleve.create({
    data: { id: eleveId, etablissement_id: etabId, matricule: `RAP-E-${RUN}`, nom_fr: 'Ndiaye', prenom_fr: 'Awa', sexe: 'F', date_naissance: new Date('2013-03-04') },
  });
  await prisma.inscription.create({ data: { id: inscId, eleve_id: eleveId, annee_scolaire_id: anneeId, statut: 'actif' } });
  await prisma.inscriptionClasse.create({ data: { inscription_id: inscId, filiere_id: filiereId, classe_id: classeId } });

  // Une seule note : 15/20 → moyenne canonique 15, affichée 7.50 sur l'échelle /10.
  await prisma.note.create({
    data: { eleve_id: eleveId, matiere_id: matId, periode: 1, annee_scolaire_id: anneeId, valeur: 15 },
  });
});

afterAll(async () => { await nettoyer(); await prisma.$disconnect(); });

describe('Rapports — échelle du niveau et mentions (cohérence avec le bulletin)', () => {
  it('résultats-classe rend la moyenne sur l’échelle du NIVEAU, pas sur la base établissement', async () => {
    const { html } = await apercuResultatsClasse(etabId, { classe_id: classeId, annee_scolaire_id: anneeId, periode: 1 });

    // Canonique 15/20 → affiché 7.5/10 (l'échelle du niveau CM1).
    expect(html).toContain('7.5');
    expect(html).toContain('Moyenne / 10');
    // Avant : la moyenne canonique fuitait telle quelle dans le rapport.
    expect(html).not.toContain('>15<');
  });

  it('résultats-classe utilise les mentions du NIVEAU, pas les défauts de l’établissement', async () => {
    const { html } = await apercuResultatsClasse(etabId, { classe_id: classeId, annee_scolaire_id: anneeId, periode: 1 });

    // Seuils du niveau re-scalés sur /10 : « Excellent CM1 » à partir de 7.
    expect(html).toContain('Excellent CM1');
    expect(html).not.toContain('Bien etab');
  });

  it('le rapport affiche EXACTEMENT la moyenne et la mention du bulletin du même élève', async () => {
    // C'est l'invariant que cette PR rétablit : les deux documents doivent
    // raconter la même chose sur le même élève.
    await genererBulletins(etabId, { classe_id: classeId, annee_scolaire_id: anneeId, periode: 1, filiere: 'FR' });
    const genere = await prisma.bulletin.findFirstOrThrow({
      where: { eleve_id: eleveId, annee_scolaire_id: anneeId, periode: 1, filiere: 'FR' },
    });
    const bulletin = await getBulletin(genere.id, etabId);

    // Le bulletin s'affiche sur l'échelle du niveau et porte la mention du niveau.
    expect(bulletin.echelle_affichage).toBe(10);
    expect(bulletin.appreciation).toBe('Excellent CM1');

    const { html } = await apercuResultatsClasse(etabId, { classe_id: classeId, annee_scolaire_id: anneeId, periode: 1 });
    expect(html).toContain(bulletin.appreciation!);
  });

  it('export CSV : l’en-tête porte l’échelle affichée', async () => {
    const res = await rapportResultatsClasse(etabId, { classe_id: classeId, annee_scolaire_id: anneeId, periode: 1, format: 'csv' });
    const csv = res.buffer.toString('utf-8');
    expect(csv).toContain('Moyenne / 10');
    expect(csv).toContain('7.5');
  });
});
