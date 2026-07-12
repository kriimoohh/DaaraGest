import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import { supprimerEleve } from './eleves.service';
import { supprimerFiliere } from '../filieres/filieres.service';

// Test d'INTÉGRATION (DB réelle) des suppressions data-management (P0).
// Fixture minimale isolée, recréée avant CHAQUE test (les tests suppriment).

const RUN = randomUUID().slice(0, 8);
const etabId = `sup-etab-${RUN}`;
const anneeId = `sup-annee-${RUN}`;
const filFrId = `sup-fil-fr-${RUN}`;
const classeId = `sup-classe-${RUN}`;
const matId = `sup-mat-${RUN}`;
const eleveId = `sup-eleve-${RUN}`;
const inscId = `sup-insc-${RUN}`;
const acteurId = 'sup-acteur';

async function nettoyer() {
  await prisma.note.deleteMany({ where: { annee_scolaire_id: anneeId } });
  await prisma.bulletin.deleteMany({ where: { annee_scolaire_id: anneeId } });
  await prisma.inscriptionClasse.deleteMany({ where: { inscription: { annee_scolaire_id: anneeId } } });
  await prisma.inscription.deleteMany({ where: { annee_scolaire_id: anneeId } });
  await prisma.parent.deleteMany({ where: { eleve: { etablissement_id: etabId } } });
  await prisma.classeMatiere.deleteMany({ where: { classe_id: classeId } });
  await prisma.mention.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.classe.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.matiere.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.filiere.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.eleve.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.anneeScolaire.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.etablissement.deleteMany({ where: { id: etabId } });
}

beforeEach(async () => {
  await nettoyer();
  await prisma.etablissement.create({ data: { id: etabId, nom_fr: 'Sup Test', code: `SUP${RUN.slice(0, 3).toUpperCase()}` } });
  await prisma.anneeScolaire.create({ data: { id: anneeId, etablissement_id: etabId, libelle: '2025-2026', active: true, date_debut: new Date('2025-10-01'), date_fin: new Date('2026-07-31') } });
  await prisma.filiere.create({ data: { id: filFrId, etablissement_id: etabId, code: 'FR', nom_fr: 'Filière française', langue: 'fr', sens_ecriture: 'LTR' } });
  await prisma.classe.create({ data: { id: classeId, etablissement_id: etabId, annee_scolaire_id: anneeId, nom_fr: 'CM1', filiere: 'FR', filiere_id: filFrId } });
  await prisma.matiere.create({ data: { id: matId, etablissement_id: etabId, nom_fr: 'Maths', filiere: 'FR', filiere_id: filFrId, coeff_defaut: 2, ordre_bulletin: 1 } });
  await prisma.classeMatiere.create({ data: { classe_id: classeId, matiere_id: matId } });
  await prisma.eleve.create({ data: { id: eleveId, etablissement_id: etabId, matricule: `SUP-${RUN}`, nom_fr: 'Test', prenom_fr: 'Élève', sexe: 'M', date_naissance: new Date('2015-01-01') } });
  await prisma.parent.create({ data: { eleve_id: eleveId, nom_fr: 'Parent Test', lien: 'Père', telephone: '770000000' } });
  await prisma.inscription.create({ data: { id: inscId, eleve_id: eleveId, annee_scolaire_id: anneeId, statut: 'actif' } });
  await prisma.inscriptionClasse.create({ data: { inscription_id: inscId, filiere_id: filFrId, classe_id: classeId } });
  await prisma.note.create({ data: { eleve_id: eleveId, matiere_id: matId, periode: 1, annee_scolaire_id: anneeId, valeur: 12 } });
});

afterAll(async () => {
  await nettoyer();
  await prisma.$disconnect();
});

describe('Suppression définitive d\'un élève (P0)', () => {
  it('purge l\'élève ET toutes ses dépendances (note, inscription, jointure, parent)', async () => {
    await supprimerEleve(eleveId, etabId, acteurId);

    expect(await prisma.eleve.findUnique({ where: { id: eleveId } })).toBeNull();
    expect(await prisma.note.count({ where: { eleve_id: eleveId } })).toBe(0);
    expect(await prisma.inscription.count({ where: { eleve_id: eleveId } })).toBe(0);
    expect(await prisma.inscriptionClasse.count({ where: { inscription_id: inscId } })).toBe(0);
    expect(await prisma.parent.count({ where: { eleve_id: eleveId } })).toBe(0);
  });
});

describe('Suppression de filière — garde exhaustive (P0)', () => {
  it('bloque tant que la filière est référencée (classe/matière/inscription)', async () => {
    await expect(supprimerFiliere(filFrId, etabId, acteurId)).rejects.toThrow(/encore utilisée/i);
  });

  it('bloque aussi sur une mention personnalisée seule', async () => {
    // On retire classe/matière/inscription/élève, mais on ajoute une mention filière.
    await prisma.note.deleteMany({ where: { eleve_id: eleveId } });
    await prisma.inscriptionClasse.deleteMany({ where: { inscription_id: inscId } });
    await prisma.inscription.deleteMany({ where: { id: inscId } });
    await prisma.classeMatiere.deleteMany({ where: { classe_id: classeId } });
    await prisma.classe.deleteMany({ where: { id: classeId } });
    await prisma.matiere.deleteMany({ where: { id: matId } });
    await prisma.mention.create({ data: { etablissement_id: etabId, filiere_id: filFrId, libelle_fr: 'Excellent', seuil_min: 8 } });

    await expect(supprimerFiliere(filFrId, etabId, acteurId)).rejects.toThrow(/mention/i);
  });

  it('supprime la filière quand plus rien ne la référence', async () => {
    await prisma.note.deleteMany({ where: { eleve_id: eleveId } });
    await prisma.inscriptionClasse.deleteMany({ where: { inscription_id: inscId } });
    await prisma.inscription.deleteMany({ where: { id: inscId } });
    await prisma.classeMatiere.deleteMany({ where: { classe_id: classeId } });
    await prisma.classe.deleteMany({ where: { id: classeId } });
    await prisma.matiere.deleteMany({ where: { id: matId } });

    const res = await supprimerFiliere(filFrId, etabId, acteurId);
    expect(res.ok).toBe(true);
    expect(await prisma.filiere.findUnique({ where: { id: filFrId } })).toBeNull();
  });
});
