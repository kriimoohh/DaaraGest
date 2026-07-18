import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import {
  journee, upsertSeance, modifierSeance, supprimerSeance, listerSeances,
  creerDevoir, listerDevoirs, jourDeLaDate,
  viserPeriode, listerVisas, supprimerVisa, completude,
} from './cahier.service';

// ─────────────────────────────────────────────────────────────────────────────
// Tests d'INTÉGRATION du cahier de texte (vraie base PostgreSQL) : journée
// pré-remplie depuis l'emploi du temps, upsert de séance (créneau et hors
// créneau), gardes professeur (affectations, séances d'un collègue), devoirs.
// ─────────────────────────────────────────────────────────────────────────────

const RUN = randomUUID().slice(0, 8);
const etabId = `ct-etab-${RUN}`;
const anneeId = `ct-annee-${RUN}`;
const filiereId = `ct-fil-${RUN}`;
const classeId = `ct-classe-${RUN}`;
const matiereId = `ct-mat-${RUN}`;
const creneauId = `ct-cren-${RUN}`;
// Prof A : affecté (classe × matière) + créneau du lundi. Prof B : aucune affectation.
const userA = `ct-user-a-${RUN}`;
const userB = `ct-user-b-${RUN}`;
const userDir = `ct-user-dir-${RUN}`;
const persA = `ct-pers-a-${RUN}`;
const persB = `ct-pers-b-${RUN}`;

// Un lundi fixe de l'année scolaire de test.
const LUNDI = '2026-03-02';

const acteurProfA = { id: userA, role: 'professeur' };
const acteurProfB = { id: userB, role: 'professeur' };
const acteurDir = { id: userDir, role: 'directeur' };

async function nettoyer() {
  await prisma.cahierVisa.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.devoir.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.cahierSeance.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.creneau.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.personnelMatiereClasse.deleteMany({ where: { annee_scolaire_id: anneeId } });
  await prisma.classeMatiere.deleteMany({ where: { classe_id: classeId } });
  await prisma.classe.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.matiere.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.filiere.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.personnel.deleteMany({ where: { id: { in: [persA, persB] } } });
  await prisma.utilisateur.deleteMany({ where: { id: { in: [userA, userB, userDir] } } });
  await prisma.configNotes.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.anneeScolaire.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.etablissement.deleteMany({ where: { id: etabId } });
}

beforeAll(async () => {
  await nettoyer();
  await prisma.etablissement.create({ data: { id: etabId, nom_fr: 'École Cahier Test', code: `CT${RUN.slice(0, 4).toUpperCase()}` } });
  await prisma.configNotes.create({ data: { etablissement_id: etabId } });
  await prisma.anneeScolaire.create({
    data: { id: anneeId, etablissement_id: etabId, libelle: '2025-2026', active: true, date_debut: new Date('2025-10-01'), date_fin: new Date('2026-07-31') },
  });
  await prisma.filiere.create({ data: { id: filiereId, etablissement_id: etabId, code: 'FR', nom_fr: 'Française', langue: 'fr', sens_ecriture: 'LTR' } });
  await prisma.classe.create({ data: { id: classeId, etablissement_id: etabId, annee_scolaire_id: anneeId, nom_fr: 'CE1 A', filiere_id: filiereId } });
  await prisma.matiere.create({ data: { id: matiereId, etablissement_id: etabId, nom_fr: 'Lecture', filiere_id: filiereId } });
  await prisma.classeMatiere.create({ data: { classe_id: classeId, matiere_id: matiereId } });

  // Rôles globaux (uniques par libellé) — créés si absents, jamais supprimés.
  const roleProf = await prisma.role.upsert({ where: { libelle_fr: 'professeur' }, update: {}, create: { libelle_fr: 'professeur' } });
  const roleDir = await prisma.role.upsert({ where: { libelle_fr: 'directeur' }, update: {}, create: { libelle_fr: 'directeur' } });

  await prisma.utilisateur.createMany({
    data: [
      { id: userA, etablissement_id: etabId, role_id: roleProf.id, nom_fr: 'ProfA', identifiant: `ct-a-${RUN}`, mot_de_passe: 'x' },
      { id: userB, etablissement_id: etabId, role_id: roleProf.id, nom_fr: 'ProfB', identifiant: `ct-b-${RUN}`, mot_de_passe: 'x' },
      { id: userDir, etablissement_id: etabId, role_id: roleDir.id, nom_fr: 'Directeur', identifiant: `ct-d-${RUN}`, mot_de_passe: 'x' },
    ],
  });
  await prisma.personnel.createMany({
    data: [
      { id: persA, utilisateur_id: userA },
      { id: persB, utilisateur_id: userB },
    ],
  });
  await prisma.personnelMatiereClasse.create({
    data: { personnel_id: persA, classe_id: classeId, matiere_id: matiereId, annee_scolaire_id: anneeId },
  });
  await prisma.creneau.create({
    data: {
      id: creneauId, etablissement_id: etabId, annee_scolaire_id: anneeId,
      classe_id: classeId, matiere_id: matiereId, personnel_id: persA,
      jour: 'lundi', heure_debut: '08:00', heure_fin: '09:00',
    },
  });
});

afterAll(async () => {
  await nettoyer();
  await prisma.$disconnect();
});

describe('Cahier de texte — journée & séances (DB réelle)', () => {
  it('la journée du prof est pré-remplie depuis son emploi du temps', async () => {
    expect(jourDeLaDate(LUNDI)).toBe('lundi');
    const j = await journee(etabId, userA, { date: LUNDI, annee_scolaire_id: anneeId });
    expect(j.personnel_id).toBe(persA);
    expect(j.creneaux).toHaveLength(1);
    expect(j.creneaux[0].id).toBe(creneauId);
    expect(j.seances).toHaveLength(0);

    // Un autre jour de la semaine : pas de créneau.
    const mardi = await journee(etabId, userA, { date: '2026-03-03', annee_scolaire_id: anneeId });
    expect(mardi.creneaux).toHaveLength(0);

    // Un compte sans fiche personnel a une journée vide (pas d'erreur).
    const dirJ = await journee(etabId, userDir, { date: LUNDI, annee_scolaire_id: anneeId });
    expect(dirJ.personnel_id).toBeNull();
  });

  it('upsert depuis un créneau : classe/matière/enseignant repris du créneau, sans doublon', async () => {
    const s1 = await upsertSeance(etabId, acteurProfA, {
      annee_scolaire_id: anneeId, classe_id: classeId, matiere_id: matiereId,
      date: LUNDI, creneau_id: creneauId, contenu: 'Lecture du texte « Le lion »',
    });
    expect(s1.personnel_id).toBe(persA);

    // Re-saisie du même créneau → mise à jour de LA même séance.
    const s2 = await upsertSeance(etabId, acteurProfA, {
      annee_scolaire_id: anneeId, classe_id: classeId, matiere_id: matiereId,
      date: LUNDI, creneau_id: creneauId, contenu: 'Lecture + questions de compréhension',
    });
    expect(s2.id).toBe(s1.id);
    expect(await prisma.cahierSeance.count({ where: { etablissement_id: etabId } })).toBe(1);

    const j = await journee(etabId, userA, { date: LUNDI, annee_scolaire_id: anneeId });
    expect(j.seances).toHaveLength(1);
    expect(j.seances[0].contenu).toContain('compréhension');
  });

  it("garde professeur : pas d'affectation → refus ; séance d'un collègue → refus ; direction → autorisée", async () => {
    // Prof B n'enseigne pas (classe × matière) → refus (hors créneau).
    await expect(upsertSeance(etabId, acteurProfB, {
      annee_scolaire_id: anneeId, classe_id: classeId, matiere_id: matiereId,
      date: LUNDI, contenu: 'Tentative', creneau_id: null,
    })).rejects.toThrow();

    // Prof B ne peut pas écrire sur le créneau de Prof A.
    await expect(upsertSeance(etabId, acteurProfB, {
      annee_scolaire_id: anneeId, classe_id: classeId, matiere_id: matiereId,
      date: LUNDI, creneau_id: creneauId, contenu: 'Tentative',
    })).rejects.toThrow();

    // Prof B ne peut pas modifier/supprimer la séance de Prof A.
    const seance = await prisma.cahierSeance.findFirstOrThrow({ where: { etablissement_id: etabId } });
    await expect(modifierSeance(seance.id, etabId, acteurProfB, { contenu: 'Vandalisme' })).rejects.toThrow();
    await expect(supprimerSeance(seance.id, etabId, acteurProfB)).rejects.toThrow();

    // La direction peut modifier la séance d'un enseignant.
    const maj = await modifierSeance(seance.id, etabId, acteurDir, { objectif: 'Fluence 60 mots/min' });
    expect(maj.objectif).toContain('Fluence');
  });

  it('consultation : le cahier de la classe sur un intervalle', async () => {
    const seances = await listerSeances(etabId, {
      classe_id: classeId, annee_scolaire_id: anneeId, du: '2026-03-01', au: '2026-03-07',
    });
    expect(seances).toHaveLength(1);
    expect(seances[0].matiere.nom_fr).toBe('Lecture');
    expect(seances[0].personnel.utilisateur.nom_fr).toBe('ProfA');

    // Hors intervalle → vide.
    expect(await listerSeances(etabId, {
      classe_id: classeId, annee_scolaire_id: anneeId, du: '2026-04-01', au: '2026-04-07',
    })).toHaveLength(0);
  });
});

describe('Cahier de texte — devoirs (DB réelle)', () => {
  it('création par le prof affecté, fenêtre sur « pour le », cohérence des dates', async () => {
    await creerDevoir(etabId, acteurProfA, {
      annee_scolaire_id: anneeId, classe_id: classeId, matiere_id: matiereId,
      donne_le: LUNDI, pour_le: '2026-03-04', consigne: 'Relire le texte + exercices 1 à 3', type: 'EXERCICE',
    });

    // « pour le » avant « donné le » → refus.
    await expect(creerDevoir(etabId, acteurProfA, {
      annee_scolaire_id: anneeId, classe_id: classeId, matiere_id: matiereId,
      donne_le: LUNDI, pour_le: '2026-03-01', consigne: 'Impossible', type: 'EXERCICE',
    })).rejects.toThrow();

    // Prof B (pas d'affectation) → refus.
    await expect(creerDevoir(etabId, acteurProfB, {
      annee_scolaire_id: anneeId, classe_id: classeId, matiere_id: matiereId,
      donne_le: LUNDI, pour_le: '2026-03-04', consigne: 'Tentative', type: 'EXERCICE',
    })).rejects.toThrow();

    const semaine = await listerDevoirs(etabId, {
      classe_id: classeId, annee_scolaire_id: anneeId, du: '2026-03-02', au: '2026-03-08',
    });
    expect(semaine).toHaveLength(1);
    expect(semaine[0].consigne).toContain('exercices');

    // La fenêtre porte sur pour_le, pas donne_le.
    expect(await listerDevoirs(etabId, {
      classe_id: classeId, annee_scolaire_id: anneeId, du: '2026-03-05', au: '2026-03-08',
    })).toHaveLength(0);
  });
});

// ── Phase 2 : visa direction (verrouillage) + complétude ─────────────────────
describe('Cahier de texte — visa & complétude (DB réelle)', () => {
  it('le visa verrouille l\'intervalle pour tous, dé-viser rouvre', async () => {
    const visa = await viserPeriode(etabId, { id: userDir }, {
      annee_scolaire_id: anneeId, classe_id: classeId, du: '2026-03-01', au: '2026-03-07',
      commentaire: 'Semaine contrôlée',
    });

    // Saisie du prof (créneau du lundi visé) → refus.
    await expect(upsertSeance(etabId, acteurProfA, {
      annee_scolaire_id: anneeId, classe_id: classeId, matiere_id: matiereId,
      date: LUNDI, creneau_id: creneauId, contenu: 'Tentative sous visa',
    })).rejects.toThrow(/vis/i);

    // Même la direction ne modifie pas une séance visée (il faut dé-viser).
    const seance = await prisma.cahierSeance.findFirstOrThrow({ where: { etablissement_id: etabId, date: new Date(`${LUNDI}T00:00:00Z`) } });
    await expect(modifierSeance(seance.id, etabId, acteurDir, { contenu: 'Interdit' })).rejects.toThrow(/vis/i);
    await expect(supprimerSeance(seance.id, etabId, acteurDir)).rejects.toThrow(/vis/i);

    // Devoir donné un jour visé → refus.
    await expect(creerDevoir(etabId, acteurProfA, {
      annee_scolaire_id: anneeId, classe_id: classeId, matiere_id: matiereId,
      donne_le: LUNDI, pour_le: '2026-03-10', consigne: 'Interdit', type: 'EXERCICE',
    })).rejects.toThrow(/vis/i);

    // Hors intervalle (lundi suivant) → autorisé.
    const s2 = await upsertSeance(etabId, acteurProfA, {
      annee_scolaire_id: anneeId, classe_id: classeId, matiere_id: matiereId,
      date: '2026-03-09', creneau_id: creneauId, contenu: 'Semaine suivante, libre',
    });
    expect(s2.id).toBeTruthy();

    // La journée expose la classe verrouillée au front.
    const j = await journee(etabId, userA, { date: LUNDI, annee_scolaire_id: anneeId });
    expect(j.classes_visees).toContain(classeId);

    // Liste + dé-viser → la modification redevient possible.
    const visas = await listerVisas(etabId, { classe_id: classeId, annee_scolaire_id: anneeId });
    expect(visas).toHaveLength(1);
    expect(visas[0].signataire.nom_fr).toBe('Directeur');
    await supprimerVisa(visa.id, etabId, { id: userDir });
    const maj = await modifierSeance(seance.id, etabId, acteurDir, { contenu: 'Corrigée après dé-visa' });
    expect(maj.contenu).toContain('Corrigée');
  });

  it('complétude : prévus (EDT) vs renseignés, par jour et par matière', async () => {
    // Semaine du 2026-03-02 : 1 créneau prévu (lundi), séance renseignée.
    const sem1 = await completude(etabId, { classe_id: classeId, annee_scolaire_id: anneeId, du: '2026-03-02', au: '2026-03-08' });
    expect(sem1.total_prevus).toBe(1);
    expect(sem1.total_renseignes).toBe(1);
    expect(sem1.taux).toBe(100);
    expect(sem1.par_jour).toHaveLength(1);
    expect(sem1.par_jour[0]).toMatchObject({ date: '2026-03-02', jour: 'lundi', prevus: 1, renseignes: 1 });
    expect(sem1.par_matiere[0]).toMatchObject({ prevus: 1, renseignes: 1 });

    // Semaine sans aucune saisie : prévu 1 (lundi), renseigné 0 → taux 0.
    const semVide = await completude(etabId, { classe_id: classeId, annee_scolaire_id: anneeId, du: '2026-04-06', au: '2026-04-12' });
    expect(semVide.total_prevus).toBe(1);
    expect(semVide.total_renseignes).toBe(0);
    expect(semVide.taux).toBe(0);

    // Intervalle incohérent ou trop grand → refus.
    await expect(completude(etabId, { classe_id: classeId, annee_scolaire_id: anneeId, du: '2026-04-12', au: '2026-04-06' })).rejects.toThrow();
    await expect(completude(etabId, { classe_id: classeId, annee_scolaire_id: anneeId, du: '2025-01-01', au: '2026-12-31' })).rejects.toThrow();
  });
});
