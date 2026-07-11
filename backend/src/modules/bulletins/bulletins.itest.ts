import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import { genererBulletins, genererBulletinsAnnuels, getBulletin, calculerMoyennesClasse, filieresActivesCodes, getBaremesClasse } from './bulletins.service';

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
const classeArId = `itest-classe-ar-${RUN}`; // classe arabe distincte (élève bilingue)
const classeEnId = `itest-classe-en-${RUN}`; // classe anglaise (Phase 3-1b)
const classeBaremeId = `itest-classe-bareme-${RUN}`; // isolée : test du repli barème matière
const filiereFrId = `itest-fil-fr-${RUN}`;
const filiereArId = `itest-fil-ar-${RUN}`;
const filiereEnId = `itest-fil-en-${RUN}`;

const ids = {
  matMath: `itest-mat-math-${RUN}`,
  matFr: `itest-mat-fr-${RUN}`,
  matRlc: `itest-mat-rlc-${RUN}`, // matière avec barème /60 via override de classe
  matAr: `itest-mat-ar-${RUN}`,   // matière de la filière arabe
  matEn: `itest-mat-en-${RUN}`,   // matière de la filière anglaise
  matBareme: `itest-mat-bareme-${RUN}`, // matière avec barème /50 porté par la MATIÈRE (pas d'override classe)
  eleveA: `itest-eleve-a-${RUN}`,
  eleveB: `itest-eleve-b-${RUN}`,
  inscA: `itest-insc-a-${RUN}`,
  inscB: `itest-insc-b-${RUN}`,
};

async function nettoyer() {
  // Ordre de suppression : enfants avant parents (aucune cascade côté Eleve).
  await prisma.bulletin.deleteMany({ where: { annee_scolaire_id: anneeId } });
  await prisma.note.deleteMany({ where: { annee_scolaire_id: anneeId } });
  // Jointure avant inscription/classe/filiere (FK RESTRICT sur classe & filière).
  await prisma.inscriptionClasse.deleteMany({ where: { inscription: { annee_scolaire_id: anneeId } } });
  await prisma.inscription.deleteMany({ where: { annee_scolaire_id: anneeId } });
  await prisma.classeMatiere.deleteMany({ where: { classe_id: { in: [classeId, classeArId, classeEnId, classeBaremeId] } } });
  await prisma.note.deleteMany({ where: { matiere: { etablissement_id: etabId } } });
  await prisma.classe.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.matiere.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.filiere.deleteMany({ where: { etablissement_id: etabId } });
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

  // Filières (entité Phase 0) + filiere_id sur les classes (jointure Phase 2b lit ceci).
  await prisma.filiere.createMany({
    data: [
      { id: filiereFrId, etablissement_id: etabId, code: 'FR', nom_fr: 'Filière française', langue: 'fr', sens_ecriture: 'LTR' },
      { id: filiereArId, etablissement_id: etabId, code: 'AR', nom_fr: 'Filière arabe', langue: 'ar', sens_ecriture: 'RTL' },
      { id: filiereEnId, etablissement_id: etabId, code: 'EN', nom_fr: 'Filière anglaise', langue: 'en', sens_ecriture: 'LTR' },
    ],
  });

  await prisma.classe.create({
    data: { id: classeId, etablissement_id: etabId, annee_scolaire_id: anneeId, nom_fr: 'CM1 A', filiere: 'FR', filiere_id: filiereFrId },
  });
  // Classe arabe distincte : l'élève bilingue y suit ses matières AR. Sert à
  // vérifier que le bulletin COMBINE agrège bien les DEUX classes de l'élève.
  await prisma.classe.create({
    data: { id: classeArId, etablissement_id: etabId, annee_scolaire_id: anneeId, nom_fr: 'CM1 Arabe', filiere: 'AR', filiere_id: filiereArId },
  });
  // Classe anglaise (Phase 3-1b) : l'élève B y suit une matière EN.
  await prisma.classe.create({
    data: { id: classeEnId, etablissement_id: etabId, annee_scolaire_id: anneeId, nom_fr: 'CM1 English', filiere: 'EN', filiere_id: filiereEnId },
  });
  // Classe isolée (sans élève) pour tester le repli du barème porté par la MATIÈRE.
  await prisma.classe.create({
    data: { id: classeBaremeId, etablissement_id: etabId, annee_scolaire_id: anneeId, nom_fr: 'CM1 Barème', filiere: 'FR', filiere_id: filiereFrId },
  });

  // Matières FR. Le barème de saisie est porté par la classe (note_max_override) ;
  // sans override, une note est réputée sur l'échelle établissement (ici /20).
  await prisma.matiere.createMany({
    data: [
      { id: ids.matMath, etablissement_id: etabId, nom_fr: 'Mathématiques', filiere: 'FR', coeff_defaut: 2, ordre_bulletin: 1 },
      { id: ids.matFr, etablissement_id: etabId, nom_fr: 'Français', filiere: 'FR', coeff_defaut: 1, ordre_bulletin: 2 },
      { id: ids.matRlc, etablissement_id: etabId, nom_fr: 'Lecture (RLC)', filiere: 'FR', coeff_defaut: 1, ordre_bulletin: 3 },
      { id: ids.matAr, etablissement_id: etabId, nom_fr: 'Langue arabe', filiere: 'AR', coeff_defaut: 1, ordre_bulletin: 1 },
      { id: ids.matEn, etablissement_id: etabId, nom_fr: 'Mathematics', filiere: 'EN', coeff_defaut: 2, ordre_bulletin: 1 },
      // Barème /50 porté par la MATIÈRE (pas d'override de classe) — Phase 1.
      { id: ids.matBareme, etablissement_id: etabId, nom_fr: 'Récitation', filiere: 'FR', coeff_defaut: 1, note_max: 50, ordre_bulletin: 9 },
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
      // Matière AR dans la classe arabe (barème /20 = échelle établissement).
      { classe_id: classeArId, matiere_id: ids.matAr, note_max_override: 20 },
      // Matière EN dans la classe anglaise (barème /20 = échelle établissement).
      { classe_id: classeEnId, matiere_id: ids.matEn, note_max_override: 20 },
      // Récitation : AUCUN override de classe → le barème effectif doit venir de
      // Matiere.note_max (/50), pas de l'échelle établissement (/20). Phase 1.
      { classe_id: classeBaremeId, matiere_id: ids.matBareme },
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
      // Élève A : bilingue (classes FR + AR via la jointure ci-dessous).
      { id: ids.inscA, eleve_id: ids.eleveA, annee_scolaire_id: anneeId, statut: 'actif' },
      // Élève B : FR uniquement — le COMBINE doit alors valoir le FR seul.
      { id: ids.inscB, eleve_id: ids.eleveB, annee_scolaire_id: anneeId, statut: 'actif' },
    ],
  });
  // Jointure InscriptionClasse (Phase 2a) : une ligne par classe assignée — c'est
  // la source lue par les bulletins depuis la Phase 2b (les colonnes ne servent plus).
  await prisma.inscriptionClasse.createMany({
    data: [
      { inscription_id: ids.inscA, filiere_id: filiereFrId, classe_id: classeId },
      { inscription_id: ids.inscA, filiere_id: filiereArId, classe_id: classeArId },
      { inscription_id: ids.inscB, filiere_id: filiereFrId, classe_id: classeId },
      // Élève B également inscrit en filière anglaise (Phase 3-1b). N'affecte ni le
      // bulletin FR (autre classe) ni le COMBINE (qui n'agrège que FR + AR).
      { inscription_id: ids.inscB, filiere_id: filiereEnId, classe_id: classeEnId },
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
      // Élève A, filière AR : Langue arabe 10/20 (c1) → (10/20)*20*1 = 10.
      { eleve_id: ids.eleveA, matiere_id: ids.matAr, periode: 1, annee_scolaire_id: anneeId, valeur: 10 },
      // Élève B, filière EN : Mathematics 16/20 (c2) → moyenne EN = 16.00 ("Très bien").
      { eleve_id: ids.eleveB, matiere_id: ids.matEn, periode: 1, annee_scolaire_id: anneeId, valeur: 16 },
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

  it('COMBINE générique : agrège les filières de chaque élève (FR+AR / FR+EN)', async () => {
    const res = await genererBulletins(etabId, {
      classe_id: classeId, annee_scolaire_id: anneeId, periode: 1, filiere: 'COMBINE',
    });
    expect(res.bulletins).toHaveLength(2);

    const bulletins = await prisma.bulletin.findMany({
      where: { annee_scolaire_id: anneeId, periode: 1, filiere: 'COMBINE' },
    });
    const parEleve = Object.fromEntries(bulletins.map(b => [b.eleve_id, b]));

    // Établissement FR+AR+EN actifs → COMBINE générique (Phase 3-2) : fusion des
    // filières où CHAQUE élève est inscrit (classes absentes ignorées par élève).
    // Élève A (FR + AR) : FR (30+16+15, coeff 4) + AR (10, coeff 1) = 71/5 = 14.2.
    // (EN ignoré : pas de classe EN pour A.)
    expect(Number(parEleve[ids.eleveA].moyenne)).toBeCloseTo(14.2, 2);
    // Élève B (FR + EN) : FR (20+10+10, coeff 4) + EN (32, coeff 2) = 72/6 = 12.00.
    // (AR ignoré : pas de classe AR pour B. Prouve la fusion FR+EN générique.)
    expect(Number(parEleve[ids.eleveB].moyenne)).toBeCloseTo(12.0, 2);

    // Classement combiné : A (14.2) devant B (12.0).
    expect(parEleve[ids.eleveA].rang).toBe(1);
    expect(parEleve[ids.eleveB].rang).toBe(2);
  });

  it('EN (filière anglaise) : génère un bulletin et expose notesByFiliere.EN', async () => {
    const res = await genererBulletins(etabId, {
      classe_id: classeEnId, annee_scolaire_id: anneeId, periode: 1, filiere: 'EN',
    });
    // Seul l'élève B est inscrit en filière anglaise.
    expect(res.bulletins).toHaveLength(1);

    const b = await prisma.bulletin.findFirst({ where: { eleve_id: ids.eleveB, periode: 1, filiere: 'EN' } });
    expect(b).not.toBeNull();
    // Mathematics 16/20 (coeff 2) → moyenne normalisée = 16.00, mention "Très bien".
    expect(Number(b!.moyenne)).toBeCloseTo(16.0, 2);
    expect(b!.appreciation).toBe('Très bien');

    // Le détail doit renvoyer les notes SOUS la clé EN (et non FR/AR).
    const detail = await getBulletin(b!.id, etabId);
    expect(detail.notesByFiliere.EN).toHaveLength(1);
    expect(detail.notesByFiliere.FR).toBeUndefined();
  });

  it('stats/rapports : calculerMoyennesClasse est générique (EN sans crash, codes actifs)', async () => {
    // Chemin qui plantait avant (classIdsByFiliere était figé FR/AR) : filière EN seule.
    const moysEN = await calculerMoyennesClasse(etabId, classeEnId, anneeId, [1], ['EN']);
    expect(moysEN.get(ids.eleveB)).toBeCloseTo(16.0, 2); // Mathematics 16/20

    // Codes actifs de l'établissement = FR+AR+EN (ordre canonique).
    const codes = await filieresActivesCodes(etabId);
    expect(codes).toEqual(['FR', 'AR', 'EN']);

    // Moyenne combinée par élève via les codes actifs (comme un rapport de classe) :
    // A (FR+AR) = 14.2 ; B (FR+EN) = 12.0. Prouve l'agrégation multi-filières.
    const moysCombine = await calculerMoyennesClasse(etabId, classeId, anneeId, [1], codes);
    expect(moysCombine.get(ids.eleveA)).toBeCloseTo(14.2, 2);
    expect(moysCombine.get(ids.eleveB)).toBeCloseTo(12.0, 2);
  });

  it('barème effectif : Matiere.note_max sert de repli quand la classe n\'override pas (Phase 1)', async () => {
    // classeBareme n'a AUCUN override de barème sur Récitation → le barème effectif
    // doit venir de Matiere.note_max (/50), et non de l'échelle établissement (/20).
    const baremes = await getBaremesClasse(classeBaremeId, [1], ['FR'], 20);
    expect(baremes.get(`${ids.matBareme}|1`)?.note_max).toBe(50);
  });
});
