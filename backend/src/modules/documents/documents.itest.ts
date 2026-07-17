import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import { apercuDocumentHtml } from './documents.service';

// Régression : le relevé de notes appelait getBaremesClasse() SANS son 4e argument
// `baseNote`. Ce paramètre ayant un défaut à DEFAULT_NOTE_MAX (20), l'oubli
// compilait sans erreur et forçait l'échelle /20 en bout de chaîne de barèmes.
// Sur un établissement en /10, le document affichait « 8.00 / 20 » et divisait la
// moyenne par deux par rapport au bulletin. Tout se joue donc sur un établissement
// dont l'échelle N'EST PAS 20 : sur /20, le bug est invisible.

const RUN = randomUUID().slice(0, 8);
const etabId    = `doc-etab-${RUN}`;
const anneeId   = `doc-annee-${RUN}`;
const filiereId = `doc-fil-${RUN}`;
const classeId  = `doc-classe-${RUN}`;
const matSansBaremeId = `doc-mat-sans-${RUN}`;
const matAvecBaremeId = `doc-mat-avec-${RUN}`;
const eleveId   = `doc-eleve-${RUN}`;
const inscId    = `doc-insc-${RUN}`;

async function nettoyer() {
  await prisma.note.deleteMany({ where: { annee_scolaire_id: anneeId } });
  await prisma.inscriptionClasse.deleteMany({ where: { inscription: { annee_scolaire_id: anneeId } } });
  await prisma.inscription.deleteMany({ where: { annee_scolaire_id: anneeId } });
  await prisma.classeMatiere.deleteMany({ where: { classe_id: classeId } });
  await prisma.classe.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.matiere.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.filiere.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.eleve.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.configNotes.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.anneeScolaire.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.etablissement.deleteMany({ where: { id: etabId } });
}

beforeAll(async () => {
  await nettoyer();

  await prisma.etablissement.create({
    data: { id: etabId, nom_fr: 'École Relevé /10', code: `DOC${RUN.slice(0, 3).toUpperCase()}` },
  });

  // ⚠️ Le cœur du test : l'échelle de l'établissement est /10, PAS /20.
  await prisma.configNotes.create({
    data: { etablissement_id: etabId, note_max: 10, nb_periodes: 3 },
  });

  await prisma.anneeScolaire.create({
    data: {
      id: anneeId, etablissement_id: etabId, libelle: '2025-2026', active: true,
      date_debut: new Date('2025-10-01'), date_fin: new Date('2026-07-31'),
    },
  });
  await prisma.filiere.create({
    data: { id: filiereId, etablissement_id: etabId, code: 'FR', nom_fr: 'Filière française', langue: 'fr', sens_ecriture: 'LTR' },
  });
  await prisma.classe.create({
    data: { id: classeId, etablissement_id: etabId, annee_scolaire_id: anneeId, nom_fr: 'CM1 A', filiere_id: filiereId },
  });

  await prisma.matiere.createMany({
    data: [
      // Aucun barème à aucun niveau → le repli de bout de chaîne s'applique.
      // C'est CE cas que le bug cassait : il retombait sur 20 au lieu de 10.
      { id: matSansBaremeId, etablissement_id: etabId, nom_fr: 'Mathématiques', filiere_id: filiereId, coeff_defaut: 1, ordre_bulletin: 1 },
      // Barème explicite /50 porté par la matière : sert de témoin — ce cas
      // n'emprunte PAS le repli, il doit rester correct avec ou sans le bug.
      { id: matAvecBaremeId, etablissement_id: etabId, nom_fr: 'Récitation', filiere_id: filiereId, coeff_defaut: 1, note_max: 50, ordre_bulletin: 2 },
    ],
  });
  await prisma.classeMatiere.createMany({
    data: [
      { classe_id: classeId, matiere_id: matSansBaremeId },
      { classe_id: classeId, matiere_id: matAvecBaremeId },
    ],
  });

  await prisma.eleve.create({
    data: { id: eleveId, etablissement_id: etabId, matricule: `DOC-E-${RUN}`, nom_fr: 'Diop', prenom_fr: 'Fatou', sexe: 'F', date_naissance: new Date('2013-05-02') },
  });
  await prisma.inscription.create({
    data: { id: inscId, eleve_id: eleveId, annee_scolaire_id: anneeId, statut: 'actif' },
  });
  await prisma.inscriptionClasse.create({
    data: { inscription_id: inscId, filiere_id: filiereId, classe_id: classeId },
  });

  // Maths 8/10 (barème = échelle établissement) ; Récitation 25/50.
  await prisma.note.createMany({
    data: [
      { eleve_id: eleveId, matiere_id: matSansBaremeId, periode: 1, annee_scolaire_id: anneeId, valeur: 8 },
      { eleve_id: eleveId, matiere_id: matAvecBaremeId, periode: 1, annee_scolaire_id: anneeId, valeur: 25 },
    ],
  });
});

afterAll(async () => { await nettoyer(); await prisma.$disconnect(); });

describe('Documents — relevé de notes sur un établissement en /10', () => {
  it('affiche chaque note sur SON barème effectif, pas sur le /20 par défaut', async () => {
    const { html } = await apercuDocumentHtml(etabId, { type: 'RELEVE_NOTES', destinataire_type: 'eleve', destinataire_id: eleveId });

    // Maths n'a aucun barème → repli sur l'échelle établissement = /10.
    // Avec le bug (baseNote non transmis), ce serait « 8.00 / 20 ».
    expect(html).toContain('8.00 / 10');
    expect(html).not.toContain('8.00 / 20');

    // Témoin : la matière à barème explicite /50 est inchangée par le bug.
    expect(html).toContain('25.00 / 50');
  });

  it('la moyenne de période est normalisée sur l’échelle /10 de l’établissement', async () => {
    const { html } = await apercuDocumentHtml(etabId, { type: 'RELEVE_NOTES', destinataire_type: 'eleve', destinataire_id: eleveId });

    // Maths : (8/10)*10*1 = 8 ; Récitation : (25/50)*10*1 = 5 → (8+5)/2 = 6.50 sur /10.
    // Avec le bug, Maths valait (8/20)*10*1 = 4 → moyenne (4+5)/2 = 4.50 : faux.
    expect(html).toContain('6.50 / 10');
    expect(html).not.toContain('4.50 / 10');
  });
});
