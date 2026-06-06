import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import { genererBulletins, genererBulletinsAnnuels, getBulletin } from './bulletins.service';

// ─────────────────────────────────────────────────────────────────────────────
// Test d'INTÉGRATION (nécessite une vraie base PostgreSQL via DATABASE_URL).
// Couvre la chaîne notes → bulletins → moyenne, y compris :
//   - la normalisation sur l'échelle de l'établissement (ConfigNotes.note_max),
//   - le barème par classe (ClasseMatiere.note_max_override),
//   - le classement (rang) et la mention.
// C'est la zone la plus retouchée récemment (barème par classe, moyenne /10),
// donc la plus exposée aux régressions — d'où une couverture bout-en-bout.
// ─────────────────────────────────────────────────────────────────────────────

// Préfixe unique pour isoler ce run et permettre un nettoyage ciblé.
const RUN = randomUUID().slice(0, 8);
const etabId = `itest-etab-${RUN}`;
const anneeId = `itest-annee-${RUN}`;
const classeId = `itest-classe-${RUN}`;

const ids = {
  matMath: `itest-mat-math-${RUN}`,
  matFr: `itest-mat-fr-${RUN}`,
  matRlc: `itest-mat-rlc-${RUN}`, // matière avec barème /60 via override de classe
  eleveA: `itest-eleve-a-${RUN}`,
  eleveB: `itest-eleve-b-${RUN}`,
};

async function nettoyer() {
  // Ordre de suppression : enfants avant parents (aucune cascade côté Eleve).
  await prisma.bulletin.deleteMany({ where: { annee_scolaire_id: anneeId } });
  await prisma.note.deleteMany({ where: { annee_scolaire_id: anneeId } });
  await prisma.inscription.deleteMany({ where: { annee_scolaire_id: anneeId } });
  await prisma.classeMatiere.deleteMany({ where: { classe_id: classeId } });
  await prisma.note.deleteMany({ where: { matiere: { etablissement_id: etabId } } });
  await prisma.classe.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.matiere.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.eleve.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.mention.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.configNotes.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.anneeScolaire.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.etablissement.deleteMany({ where: { id: etabId } });
}

beforeAll(async () => {
  await nettoyer();

  await prisma.etablissement.create({
    data: { id: etabId, nom_fr: 'École Test Intégration', code: `IT${RUN.slice(0, 4).toUpperCase()}` },
  });

  // Échelle de l'établissement = /20 (base de normalisation des moyennes).
  await prisma.configNotes.create({
    data: { etablissement_id: etabId, note_max: 20, nb_periodes: 3 },
  });

  // Mentions configurables (triées par seuil décroissant côté service).
  await prisma.mention.createMany({
    data: [
      { etablissement_id: etabId, libelle_fr: 'Très bien', seuil_min: 16, ordre: 4 },
      { etablissement_id: etabId, libelle_fr: 'Bien', seuil_min: 14, ordre: 3 },
      { etablissement_id: etabId, libelle_fr: 'Assez bien', seuil_min: 12, ordre: 2 },
      { etablissement_id: etabId, libelle_fr: 'Passable', seuil_min: 10, ordre: 1 },
      { etablissement_id: etabId, libelle_fr: 'Insuffisant', seuil_min: 0, ordre: 0 },
    ],
  });

  await prisma.anneeScolaire.create({
    data: {
      id: anneeId, etablissement_id: etabId, libelle: '2025-2026', active: true,
      date_debut: new Date('2025-10-01'), date_fin: new Date('2026-07-31'),
    },
  });

  await prisma.classe.create({
    data: { id: classeId, etablissement_id: etabId, annee_scolaire_id: anneeId, nom_fr: 'CM1 A', filiere: 'FR' },
  });

  // Matières FR. Le barème de saisie est porté par la classe (note_max_override) ;
  // sans override, une note est réputée sur l'échelle établissement (ici /20).
  await prisma.matiere.createMany({
    data: [
      { id: ids.matMath, etablissement_id: etabId, nom_fr: 'Mathématiques', filiere: 'FR', coeff_defaut: 2, ordre_bulletin: 1 },
      { id: ids.matFr, etablissement_id: etabId, nom_fr: 'Français', filiere: 'FR', coeff_defaut: 1, ordre_bulletin: 2 },
      { id: ids.matRlc, etablissement_id: etabId, nom_fr: 'Lecture (RLC)', filiere: 'FR', coeff_defaut: 1, ordre_bulletin: 3 },
    ],
  });

  await prisma.classeMatiere.createMany({
    data: [
      // Math : pas d'override → barème = échelle établissement (/20).
      { classe_id: classeId, matiere_id: ids.matMath },
      // Français saisi sur /10 dans cette classe (barème par classe).
      { classe_id: classeId, matiere_id: ids.matFr, note_max_override: 10 },
      // RLC saisie sur /60 dans cette classe.
      { classe_id: classeId, matiere_id: ids.matRlc, note_max_override: 60 },
    ],
  });

  await prisma.eleve.createMany({
    data: [
      { id: ids.eleveA, etablissement_id: etabId, matricule: `IT-A-${RUN}`, nom_fr: 'Ndiaye', prenom_fr: 'Awa', sexe: 'F', date_naissance: new Date('2015-03-12') },
      { id: ids.eleveB, etablissement_id: etabId, matricule: `IT-B-${RUN}`, nom_fr: 'Diop', prenom_fr: 'Babacar', sexe: 'M', date_naissance: new Date('2015-06-20') },
    ],
  });

  await prisma.inscription.createMany({
    data: [
      { eleve_id: ids.eleveA, classe_fr_id: classeId, annee_scolaire_id: anneeId, statut: 'actif' },
      { eleve_id: ids.eleveB, classe_fr_id: classeId, annee_scolaire_id: anneeId, statut: 'actif' },
    ],
  });

  // Notes période 1.
  // Élève A : Math 15/20 (c2), Français 8/10 (c1), RLC 45/60 (c1, override).
  //   contributions (base 20) :
  //     Math : (15/20)*20*2 = 30 ; Français : (8/10)*20*1 = 16 ; RLC : (45/60)*20*1 = 15
  //   moyenne = (30+16+15)/(2+1+1) = 61/4 = 15.25
  // Élève B : Math 10/20 (c2), Français 5/10 (c1), RLC 30/60 (c1).
  //     Math : (10/20)*20*2 = 20 ; Français : (5/10)*20 = 10 ; RLC : (30/60)*20 = 10
  //   moyenne = (20+10+10)/4 = 40/4 = 10.00
  await prisma.note.createMany({
    data: [
      { eleve_id: ids.eleveA, matiere_id: ids.matMath, periode: 1, annee_scolaire_id: anneeId, valeur: 15 },
      { eleve_id: ids.eleveA, matiere_id: ids.matFr, periode: 1, annee_scolaire_id: anneeId, valeur: 8 },
      { eleve_id: ids.eleveA, matiere_id: ids.matRlc, periode: 1, annee_scolaire_id: anneeId, valeur: 45 },
      { eleve_id: ids.eleveB, matiere_id: ids.matMath, periode: 1, annee_scolaire_id: anneeId, valeur: 10 },
      { eleve_id: ids.eleveB, matiere_id: ids.matFr, periode: 1, annee_scolaire_id: anneeId, valeur: 5 },
      { eleve_id: ids.eleveB, matiere_id: ids.matRlc, periode: 1, annee_scolaire_id: anneeId, valeur: 30 },
    ],
  });
});

afterAll(async () => {
  await nettoyer();
  await prisma.$disconnect();
});

describe('Bulletins — intégration notes → moyenne (DB réelle)', () => {
  it('génère les bulletins trimestriels avec moyennes normalisées et classement', async () => {
    const res = await genererBulletins(etabId, {
      classe_id: classeId, annee_scolaire_id: anneeId, periode: 1, filiere: 'FR',
    });
    expect(res.bulletins).toHaveLength(2);

    const bulletins = await prisma.bulletin.findMany({
      where: { annee_scolaire_id: anneeId, periode: 1, filiere: 'FR' },
    });
    const parEleve = Object.fromEntries(bulletins.map(b => [b.eleve_id, b]));

    // Moyenne élève A : 15.25 (dont RLC normalisée depuis /60).
    expect(Number(parEleve[ids.eleveA].moyenne)).toBeCloseTo(15.25, 2);
    // Moyenne élève B : 10.00.
    expect(Number(parEleve[ids.eleveB].moyenne)).toBeCloseTo(10.0, 2);

    // Classement : A (15.25) devant B (10.00).
    expect(parEleve[ids.eleveA].rang).toBe(1);
    expect(parEleve[ids.eleveB].rang).toBe(2);

    // Mention sur l'échelle établissement : A "Bien" (≥14), B "Passable" (≥10).
    expect(parEleve[ids.eleveA].appreciation).toBe('Bien');
    expect(parEleve[ids.eleveB].appreciation).toBe('Passable');
  });

  it('régénère (upsert) sans dupliquer ni dériver la moyenne', async () => {
    await genererBulletins(etabId, { classe_id: classeId, annee_scolaire_id: anneeId, periode: 1, filiere: 'FR' });
    const count = await prisma.bulletin.count({ where: { annee_scolaire_id: anneeId, periode: 1, filiere: 'FR' } });
    expect(count).toBe(2);
  });

  it('le détail du bulletin renvoie les notes par filière', async () => {
    const b = await prisma.bulletin.findFirst({ where: { eleve_id: ids.eleveA, periode: 1, filiere: 'FR' } });
    const detail = await getBulletin(b!.id, etabId);
    expect(detail.notesByFiliere.FR).toHaveLength(3);
  });

  it('le bulletin annuel moyenne les périodes saisies', async () => {
    const res = await genererBulletinsAnnuels(etabId, { classe_id: classeId, annee_scolaire_id: anneeId, filiere: 'FR' });
    expect(res.bulletins).toHaveLength(2);
    const annuelA = await prisma.bulletin.findFirst({
      where: { eleve_id: ids.eleveA, periode: 0, filiere: 'FR' },
    });
    // Seule la période 1 est saisie → la moyenne annuelle = moyenne période 1.
    expect(Number(annuelA!.moyenne)).toBeCloseTo(15.25, 2);
  });
});
