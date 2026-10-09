import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import { porteeDe, eleveVisible, bulletinVisible, classeVisible } from '../../utils/portee';
import { assertProfPeutSaisirNotes } from '../../utils/teachingPolicy';
import { listerClasses } from '../classes/classes.service';
import { listerEleves } from '../eleves/eleves.service';
import { listerNotes, bulkUpsertNotes } from '../notes/notes.service';
import { listerAbsences, getStatsAbsences } from '../absences/absences.service';
import { listerBulletins } from '../bulletins/bulletins.service';
import { listerEvaluations } from '../evaluations/evaluations.service';

// Test d'INTÉGRATION (DB réelle) du périmètre « le professeur ne voit que ses classes »
// (audit SenInit DG-AUTHZ-001, confirmé en production : un professeur affecté à une seule classe
// lisait toute l'école). Deux classes A et B ; le professeur n'est affecté qu'à A.

const RUN = randomUUID().slice(0, 8);
const id = (p: string) => `${p}-${RUN}`;
const E = id('pt-etab'), E2 = id('pt-etab2');
const AN = randomUUID(), AN2 = randomUUID();
const FIL = id('pt-fil'), FIL2 = id('pt-fil2');
const CA = randomUUID(), CB = randomUUID(), CX = randomUUID();
const MAT = randomUUID(), MAT2 = randomUUID();
const ELA = randomUUID(), ELB = randomUUID(), ELX = randomUUID();
const U_PROF = id('pt-uprof'), U_SANS = id('pt-usans'), U_ADMIN = id('pt-uadmin');
const P_PROF = id('pt-pprof'), P_SANS = id('pt-psans');
let bullA = '', bullB = '';

async function nettoyer() {
  const ids = [E, E2];
  await prisma.note.deleteMany({ where: { eleve: { etablissement_id: { in: ids } } } });
  await prisma.noteEvaluation.deleteMany({ where: { evaluation: { etablissement_id: { in: ids } } } });
  await prisma.evaluation.deleteMany({ where: { etablissement_id: { in: ids } } });
  await prisma.absenceEleve.deleteMany({ where: { etablissement_id: { in: ids } } });
  await prisma.bulletin.deleteMany({ where: { eleve: { etablissement_id: { in: ids } } } });
  await prisma.personnelMatiereClasse.deleteMany({ where: { classe: { etablissement_id: { in: ids } } } });
  await prisma.inscriptionClasse.deleteMany({ where: { classe: { etablissement_id: { in: ids } } } });
  await prisma.inscription.deleteMany({ where: { eleve: { etablissement_id: { in: ids } } } });
  await prisma.parent.deleteMany({ where: { eleve: { etablissement_id: { in: ids } } } });
  await prisma.eleve.deleteMany({ where: { etablissement_id: { in: ids } } });
  await prisma.classeMatiere.deleteMany({ where: { classe: { etablissement_id: { in: ids } } } });
  await prisma.classe.deleteMany({ where: { etablissement_id: { in: ids } } });
  await prisma.matiere.deleteMany({ where: { etablissement_id: { in: ids } } });
  await prisma.filiere.deleteMany({ where: { etablissement_id: { in: ids } } });
  await prisma.personnel.deleteMany({ where: { utilisateur: { etablissement_id: { in: ids } } } });
  await prisma.utilisateur.deleteMany({ where: { etablissement_id: { in: ids } } });
  await prisma.configNotes.deleteMany({ where: { etablissement_id: { in: ids } } });
  await prisma.anneeScolaire.deleteMany({ where: { etablissement_id: { in: ids } } });
  await prisma.etablissement.deleteMany({ where: { id: { in: ids } } });
}

beforeAll(async () => {
  await nettoyer();
  const j = 86_400_000;
  for (const [e, code] of [[E, 'PT1'], [E2, 'PT2']] as const)
    await prisma.etablissement.create({ data: { id: e, nom_fr: `Portée ${code}`, code: `${code}${RUN.slice(0, 3).toUpperCase()}` } });
  await prisma.anneeScolaire.create({ data: { id: AN, etablissement_id: E, libelle: 'N', active: true, date_debut: new Date(Date.now() - 30 * j), date_fin: new Date(Date.now() + 250 * j) } });
  await prisma.anneeScolaire.create({ data: { id: AN2, etablissement_id: E2, libelle: 'N', active: true, date_debut: new Date(Date.now() - 30 * j), date_fin: new Date(Date.now() + 250 * j) } });
  await prisma.filiere.create({ data: { id: FIL, etablissement_id: E, code: 'FR', nom_fr: 'FR', langue: 'fr', sens_ecriture: 'LTR' } });
  await prisma.filiere.create({ data: { id: FIL2, etablissement_id: E2, code: 'FR', nom_fr: 'FR', langue: 'fr', sens_ecriture: 'LTR' } });
  await prisma.matiere.create({ data: { id: MAT, etablissement_id: E, nom_fr: 'Maths', filiere_id: FIL } });
  await prisma.matiere.create({ data: { id: MAT2, etablissement_id: E2, nom_fr: 'Maths2', filiere_id: FIL2 } });
  for (const [c, e, an, fil, nom] of [[CA, E, AN, FIL, 'CM1 A'], [CB, E, AN, FIL, 'CM2 B'], [CX, E2, AN2, FIL2, 'Autre école']] as const) {
    await prisma.classe.create({ data: { id: c, etablissement_id: e, annee_scolaire_id: an, nom_fr: nom, filiere_id: fil } });
  }
  await prisma.classeMatiere.createMany({ data: [{ classe_id: CA, matiere_id: MAT }, { classe_id: CB, matiere_id: MAT }] });
  const role = await prisma.role.upsert({ where: { libelle_fr: 'professeur' }, update: {}, create: { libelle_fr: 'professeur' } });
  const roleAdmin = await prisma.role.upsert({ where: { libelle_fr: 'admin' }, update: {}, create: { libelle_fr: 'admin' } });
  for (const [u, r, nom] of [[U_PROF, role.id, 'Prof'], [U_SANS, role.id, 'Sans'], [U_ADMIN, roleAdmin.id, 'Adm']] as const)
    await prisma.utilisateur.create({ data: { id: u, etablissement_id: E, role_id: r, nom_fr: nom, identifiant: `${u}`, mot_de_passe: 'x' } });
  await prisma.personnel.create({ data: { id: P_PROF, utilisateur_id: U_PROF } });
  await prisma.personnel.create({ data: { id: P_SANS, utilisateur_id: U_SANS } });
  await prisma.personnelMatiereClasse.create({ data: { personnel_id: P_PROF, matiere_id: MAT, classe_id: CA, annee_scolaire_id: AN } });
  for (const [el, e, an, c, fil, nom] of [[ELA, E, AN, CA, FIL, 'EleveA'], [ELB, E, AN, CB, FIL, 'EleveB'], [ELX, E2, AN2, CX, FIL2, 'EleveX']] as const) {
    await prisma.eleve.create({ data: { id: el, etablissement_id: e, matricule: `PT-${nom}-${RUN}`, nom_fr: nom, prenom_fr: 'T', sexe: 'M', date_naissance: new Date('2015-01-01') } });
    await prisma.parent.create({ data: { eleve_id: el, nom_fr: `Parent ${nom}`, lien: 'Père', telephone: '770000000' } });
    const insc = randomUUID();
    await prisma.inscription.create({ data: { id: insc, eleve_id: el, annee_scolaire_id: an, statut: 'actif' } });
    await prisma.inscriptionClasse.create({ data: { inscription_id: insc, filiere_id: fil, classe_id: c } });
  }
  await prisma.note.createMany({ data: [
    { eleve_id: ELA, matiere_id: MAT, periode: 1, annee_scolaire_id: AN, valeur: 10 },
    { eleve_id: ELB, matiere_id: MAT, periode: 1, annee_scolaire_id: AN, valeur: 11 },
    { eleve_id: ELX, matiere_id: MAT2, periode: 1, annee_scolaire_id: AN2, valeur: 12 },
  ] });
  const d = new Date();
  for (const [el, c] of [[ELA, CA], [ELB, CB]] as const)
    await prisma.absenceEleve.create({ data: { eleve_id: el, classe_id: c, annee_scolaire_id: AN, etablissement_id: E, date: d, statut: 'absent' } });
  for (const c of [CA, CB])
    await prisma.evaluation.create({ data: { etablissement_id: E, classe_id: c, matiere_id: MAT, annee_scolaire_id: AN, periode: 1, titre: 'DS', type: 'DS', date: d, created_by: U_ADMIN } });
  bullA = (await prisma.bulletin.create({ data: { eleve_id: ELA, annee_scolaire_id: AN, filiere: 'FR', periode: 1 } })).id;
  bullB = (await prisma.bulletin.create({ data: { eleve_id: ELB, annee_scolaire_id: AN, filiere: 'FR', periode: 1 } })).id;
});

afterAll(async () => { await nettoyer(); await prisma.$disconnect(); });

describe('Périmètre du professeur — ne voit que ses classes', () => {
  it('porteeDe : professeur = ses classes ; sans affectation = vide ; autres rôles = aucune restriction', async () => {
    expect(await porteeDe({ id: U_PROF, role: 'professeur' })).toEqual({ classe_ids: [CA] });
    expect(await porteeDe({ id: U_SANS, role: 'professeur' })).toEqual({ classe_ids: [] });
    expect(await porteeDe({ id: U_ADMIN, role: 'admin' })).toBeNull();
    expect(await porteeDe({ id: U_ADMIN, role: 'directeur' })).toBeNull();
  });

  it('classes : seule sa classe', async () => {
    const portee = await porteeDe({ id: U_PROF, role: 'professeur' });
    expect((await listerClasses(E, undefined, undefined, portee)).map(c => c.nom_fr)).toEqual(['CM1 A']);
    expect((await listerClasses(E, undefined, undefined, null)).map(c => c.nom_fr).sort()).toEqual(['CM1 A', 'CM2 B']);
    expect(await listerClasses(E, undefined, undefined, await porteeDe({ id: U_SANS, role: 'professeur' }))).toEqual([]);
    expect(classeVisible(portee, CA)).toBe(true);
    expect(classeVisible(portee, CB)).toBe(false);
  });

  it('élèves : seulement ceux de sa classe (liste et accès direct)', async () => {
    const portee = await porteeDe({ id: U_PROF, role: 'professeur' });
    const liste = await listerEleves(E, 1, 50, undefined, undefined, undefined, undefined, 'nom_fr', 'asc', portee);
    expect(liste.data.map(e => e.nom_fr)).toEqual(['EleveA']);
    expect(await eleveVisible(portee, ELA)).toBe(true);
    expect(await eleveVisible(portee, ELB)).toBe(false);
    // le filtre classe_id d'un autre élève ne doit pas élargir le périmètre
    const croise = await listerEleves(E, 1, 50, undefined, CB, undefined, undefined, 'nom_fr', 'asc', portee);
    expect(croise.data).toEqual([]);
  });

  it('notes : seulement celles de ses élèves, jamais celles d\'un autre établissement', async () => {
    const portee = await porteeDe({ id: U_PROF, role: 'professeur' });
    expect((await listerNotes(E, undefined, undefined, undefined, undefined, portee)).map(n => Number(n.valeur))).toEqual([10]);
    await expect(listerNotes(E, CB, undefined, undefined, undefined, portee)).rejects.toThrow('introuvable');
    // sans classe_id, un admin ne voit QUE son établissement (avant : tous les établissements)
    const admin = await listerNotes(E, undefined, undefined, undefined, undefined, null);
    expect(admin.map(n => Number(n.valeur)).sort()).toEqual([10, 11]);
  });

  it('absences, bulletins et évaluations : seulement sa classe', async () => {
    const portee = await porteeDe({ id: U_PROF, role: 'professeur' });
    const abs = await listerAbsences(E, undefined, undefined, undefined, undefined, undefined, undefined, 1, portee);
    expect(abs.data.map(a => a.eleve.nom_fr)).toEqual(['EleveA']);
    expect((await getStatsAbsences(E, AN, undefined, undefined, undefined, portee)).map(s => s.eleve.nom_fr)).toEqual(['EleveA']);
    expect((await listerBulletins(E, AN, undefined, undefined, undefined, undefined, portee)).map(b => b.id)).toEqual([bullA]);
    expect(await bulletinVisible(portee, bullA)).toBe(true);
    expect(await bulletinVisible(portee, bullB)).toBe(false);
    expect((await listerEvaluations(E, undefined, undefined, undefined, undefined, portee)).map(e => e.classe.nom_fr)).toEqual(['CM1 A']);
    // l'admin voit tout
    expect(await listerEvaluations(E)).toHaveLength(2);
  });
});

describe('Saisie des notes par un professeur — l\'affectation à la classe est toujours exigée', () => {
  const note = (eleve_id: string, annee = AN, matiere_id = MAT) => ({ eleve_id, matiere_id, periode: 2, annee_scolaire_id: annee, valeur: 14 });

  it('sans classe_id : refuse un élève d\'une classe non affectée (avant : aucune vérification)', async () => {
    await expect(bulkUpsertNotes([note(ELB)], true, U_PROF, E, undefined, 'professeur')).rejects.toThrow(/enseignez pas/);
    expect(await prisma.note.count({ where: { eleve_id: ELB, periode: 2 } })).toBe(0);
  });

  it('sans classe_id : accepte un élève de sa classe', async () => {
    const r = await bulkUpsertNotes([note(ELA)], true, U_PROF, E, undefined, 'professeur');
    expect(r.created).toBe(1);
  });

  it('avec classe_id de sa classe mais un élève d\'une autre classe : refusé', async () => {
    await expect(bulkUpsertNotes([note(ELB)], true, U_PROF, E, CA, 'professeur')).rejects.toThrow(/n'appartient pas/);
  });

  it('avec classe_id d\'une classe non affectée : refusé', async () => {
    await expect(bulkUpsertNotes([note(ELB)], true, U_PROF, E, CB, 'professeur')).rejects.toThrow(/enseignez pas/);
  });

  it('même quand « toutes classes / toutes matières » est activé, une autre classe reste interdite', async () => {
    await prisma.configNotes.upsert({
      where: { etablissement_id: E }, update: { autoriser_toutes_classes: true, autoriser_toutes_matieres: true },
      create: { etablissement_id: E, autoriser_toutes_classes: true, autoriser_toutes_matieres: true },
    });
    await expect(assertProfPeutSaisirNotes('professeur', U_PROF, CB, [MAT], E)).rejects.toThrow(/enseignez pas/);
    await expect(assertProfPeutSaisirNotes('professeur', U_PROF, CA, [MAT], E)).resolves.toBeUndefined();
  });

  it('garde-fou établissement : un élève d\'un autre établissement est introuvable, même pour un admin', async () => {
    await expect(bulkUpsertNotes([note(ELX, AN, MAT)], false, U_ADMIN, E, undefined, 'admin')).rejects.toThrow('introuvable');
    expect(await prisma.note.count({ where: { eleve_id: ELX, periode: 2 } })).toBe(0);
  });
});
