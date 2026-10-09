import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import { reconduireClasses } from './classes.reconduction';

// Test d'INTÉGRATION (DB réelle) de la reconduction des classes d'une année à l'autre.

const RUN = randomUUID().slice(0, 8);
const etabId = `rec-etab-${RUN}`;
const srcId = `rec-src-${RUN}`;
const cibleId = `rec-cible-${RUN}`;
const filId = `rec-fil-${RUN}`;
const matId = `rec-mat-${RUN}`;
const mat2Id = `rec-mat2-${RUN}`;
const cmId = `rec-cm-${RUN}`;
const cm2Id = `rec-cm2-${RUN}`;
const cmId2 = `rec-cmb-${RUN}`;
const classeA = `rec-ca-${RUN}`;
const classeB = `rec-cb-${RUN}`;
const userId = `rec-user-${RUN}`;
const persId = `rec-pers-${RUN}`;

async function nettoyer() {
  const classes = { classe: { etablissement_id: etabId } };
  await prisma.personnelMatiereClasse.deleteMany({ where: classes });
  await prisma.classeMatierePeriode.deleteMany({ where: { classe_id: { in: (await prisma.classe.findMany({ where: { etablissement_id: etabId }, select: { id: true } })).map(c => c.id) } } });
  await prisma.classeMatiere.deleteMany({ where: classes });
  await prisma.classe.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.personnel.deleteMany({ where: { utilisateur: { etablissement_id: etabId } } });
  await prisma.utilisateur.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.matiere.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.filiere.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.anneeScolaire.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.etablissement.deleteMany({ where: { id: etabId } });
}

beforeAll(async () => {
  await nettoyer();
  await prisma.etablissement.create({ data: { id: etabId, nom_fr: 'Rec Test', code: `RC${RUN.slice(0, 4).toUpperCase()}` } });
  const j = 86_400_000;
  await prisma.anneeScolaire.create({ data: { id: srcId, etablissement_id: etabId, libelle: 'N-1', active: false, date_debut: new Date(Date.now() - 400 * j), date_fin: new Date(Date.now() - 100 * j) } });
  await prisma.anneeScolaire.create({ data: { id: cibleId, etablissement_id: etabId, libelle: 'N', active: true, date_debut: new Date(Date.now() - 30 * j), date_fin: new Date(Date.now() + 250 * j) } });
  await prisma.filiere.create({ data: { id: filId, etablissement_id: etabId, code: 'FR', nom_fr: 'Française', langue: 'fr', sens_ecriture: 'LTR' } });
  await prisma.matiere.create({ data: { id: matId, etablissement_id: etabId, nom_fr: 'Maths', filiere_id: filId } });
  await prisma.matiere.create({ data: { id: mat2Id, etablissement_id: etabId, nom_fr: 'Dictée', filiere_id: filId } });
  await prisma.classe.create({ data: { id: classeA, etablissement_id: etabId, annee_scolaire_id: srcId, nom_fr: 'CM1 A', filiere_id: filId, capacite: 40, code: 'CM1-A-FR', programme_par_periode: true } });
  await prisma.classe.create({ data: { id: classeB, etablissement_id: etabId, annee_scolaire_id: srcId, nom_fr: 'CM2 A', filiere_id: filId } });
  await prisma.classeMatiere.create({ data: { id: cmId, classe_id: classeA, matiere_id: matId, coeff_override: 3, note_max_override: 20, evaluee: true } });
  await prisma.classeMatiere.create({ data: { id: cm2Id, classe_id: classeA, matiere_id: mat2Id, coeff_override: 1, evaluee: false } });
  await prisma.classeMatiere.create({ data: { id: cmId2, classe_id: classeB, matiere_id: matId } });
  await prisma.classeMatierePeriode.create({ data: { classe_id: classeA, matiere_id: matId, periode: 2, coeff: 4, note_max: 10, evaluee: true } });
  // Affectation enseignant : ne doit JAMAIS être reprise.
  const role = await prisma.role.upsert({ where: { libelle_fr: 'professeur' }, update: {}, create: { libelle_fr: 'professeur' } });
  await prisma.utilisateur.create({ data: { id: userId, etablissement_id: etabId, role_id: role.id, nom_fr: 'Prof', identifiant: `rec-u-${RUN}`, mot_de_passe: 'x' } });
  await prisma.personnel.create({ data: { id: persId, utilisateur_id: userId } });
  await prisma.personnelMatiereClasse.create({ data: { personnel_id: persId, matiere_id: matId, classe_id: classeA, annee_scolaire_id: srcId } });
});

afterAll(async () => { await nettoyer(); await prisma.$disconnect(); });

const base = { annee_source_id: srcId, annee_cible_id: cibleId, matieres: 'copier' as const, apercu: false };
const classesCible = () => prisma.classe.findMany({ where: { annee_scolaire_id: cibleId }, include: { classe_matieres: true } });

describe('Reconduction des classes', () => {
  it("l'aperçu n'écrit rien et annonce ce qui sera créé", async () => {
    const r = await reconduireClasses(etabId, { ...base, apercu: true }, 'acteur');
    expect(r.resume).toEqual({ creees: 2, ignorees: 0, total: 2 });
    expect(r.lignes.every(l => l.statut === 'a_creer')).toBe(true);
    expect(await classesCible()).toHaveLength(0);
  });

  it('une sélection ne reconduit que les classes choisies, avec leur programme complet', async () => {
    const r = await reconduireClasses(etabId, { ...base, classe_ids: [classeA] }, 'acteur');
    expect(r.resume.creees).toBe(1);
    const [c] = await classesCible();
    expect(c).toMatchObject({ nom_fr: 'CM1 A', capacite: 40, code: 'CM1-A-FR', programme_par_periode: true });
    const byMat = new Map(c.classe_matieres.map(m => [m.matiere_id, m]));
    expect(Number(byMat.get(matId)!.coeff_override)).toBe(3);
    expect(byMat.get(mat2Id)!.evaluee).toBe(false);
    const ov = await prisma.classeMatierePeriode.findMany({ where: { classe_id: c.id } });
    expect(ov).toHaveLength(1);
    expect(Number(ov[0].coeff)).toBe(4);
    // Les affectations d'enseignants ne sont pas reprises.
    expect(await prisma.personnelMatiereClasse.count({ where: { classe_id: c.id } })).toBe(0);
  });

  it('est idempotent : une classe déjà présente est signalée et jamais dupliquée', async () => {
    const r = await reconduireClasses(etabId, base, 'acteur');
    expect(r.resume).toEqual({ creees: 1, ignorees: 1, total: 2 });
    expect(r.lignes.find(l => l.nom_fr === 'CM1 A')!.statut).toBe('existe');
    expect(await classesCible()).toHaveLength(2);
  });

  it("'aucune' ne reprend que la structure (pas de matières)", async () => {
    await prisma.classeMatiere.deleteMany({ where: { classe: { annee_scolaire_id: cibleId } } });
    await prisma.classe.deleteMany({ where: { annee_scolaire_id: cibleId } });
    await reconduireClasses(etabId, { ...base, matieres: 'aucune' }, 'acteur');
    const cs = await classesCible();
    expect(cs).toHaveLength(2);
    expect(cs.every(c => c.classe_matieres.length === 0)).toBe(true);
    expect(cs.find(c => c.nom_fr === 'CM1 A')!.programme_par_periode).toBe(false);
  });

  it('refuse même année, année étrangère et classes hors année source', async () => {
    await expect(reconduireClasses(etabId, { ...base, annee_cible_id: srcId }, 'a')).rejects.toThrow('différentes');
    await expect(reconduireClasses('autre-etab', base, 'a')).rejects.toThrow('introuvable');
    await expect(reconduireClasses(etabId, { ...base, classe_ids: [randomUUID()] }, 'a')).rejects.toThrow('sélectionnées');
  });
});
