import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import { genererToken, regenererToken, revoquerToken, getPortailData } from './portail-parent.service';

// Le module portail-parent n'avait aucun test. Couvre la faille corrigée par
// cette PR : un lien qui a fuité était irrévocable/irrémédiable depuis l'appli.
// - genererToken RÉUTILISE le token (ne casse pas un lien valide en le ré-affichant) ;
// - regenererToken émet un NOUVEAU token → l'ancien lien meurt aussitôt ;
// - revoquerToken désactive le lien ;
// - les 3 opérations écrivent une trace d'audit.

const RUN = randomUUID().slice(0, 8);
const etabId  = `pp-etab-${RUN}`;
const eleveId = `pp-eleve-${RUN}`;
const acteur  = `pp-acteur-${RUN}`;

async function nettoyer() {
  await prisma.auditLog.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.portailParentToken.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.devoir.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.inscriptionClasse.deleteMany({ where: { classe: { etablissement_id: etabId } } });
  await prisma.inscription.deleteMany({ where: { eleve: { etablissement_id: etabId } } });
  await prisma.personnel.deleteMany({ where: { utilisateur: { etablissement_id: etabId } } });
  await prisma.utilisateur.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.classe.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.matiere.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.filiere.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.configNotes.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.anneeScolaire.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.eleve.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.etablissement.deleteMany({ where: { id: etabId } });
}

beforeAll(async () => {
  await nettoyer();
  await prisma.etablissement.create({ data: { id: etabId, nom_fr: 'École Portail', code: `PP${RUN.slice(0, 4).toUpperCase()}` } });
  await prisma.eleve.create({
    data: { id: eleveId, etablissement_id: etabId, matricule: `PP-E-${RUN}`, nom_fr: 'Sow', prenom_fr: 'Sira', sexe: 'F', date_naissance: new Date('2012-01-01') },
  });
});

afterAll(async () => { await nettoyer(); await prisma.$disconnect(); });

describe('Portail parent — génération et rotation', () => {
  it('genererToken réutilise le même token à la ré-invocation (ne casse pas un lien valide)', async () => {
    const t1 = await genererToken(etabId, eleveId, acteur);
    const t2 = await genererToken(etabId, eleveId, acteur);
    expect(t2.token).toBe(t1.token);
    expect(t2.id).toBe(t1.id);
  });

  it('regenererToken émet un NOUVEAU token et tue l’ancien lien', async () => {
    const avant = await prisma.portailParentToken.findFirstOrThrow({ where: { etablissement_id: etabId, eleve_id: eleveId } });
    const ancienToken = avant.token;

    const apres = await regenererToken(etabId, eleveId, acteur);
    expect(apres.token).not.toBe(ancienToken);
    expect(apres.id).toBe(avant.id); // même enregistrement, token tourné

    // L'ancien lien ne correspond plus à aucun enregistrement → accès refusé.
    await expect(getPortailData(ancienToken)).rejects.toThrow(/invalide|désactivé/i);
  });

  it('regenererToken sur un élève sans lien échoue proprement', async () => {
    const autre = `pp-eleve2-${RUN}`;
    await prisma.eleve.create({
      data: { id: autre, etablissement_id: etabId, matricule: `PP-E2-${RUN}`, nom_fr: 'Ka', prenom_fr: 'Kadi', sexe: 'F', date_naissance: new Date('2012-02-02') },
    });
    await expect(regenererToken(etabId, autre, acteur)).rejects.toThrow(/aucun lien/i);
  });
});

describe('Portail parent — révocation', () => {
  it('revoquerToken désactive le lien (accès refusé)', async () => {
    const rec = await prisma.portailParentToken.findFirstOrThrow({ where: { etablissement_id: etabId, eleve_id: eleveId } });
    await revoquerToken(rec.token, etabId, acteur);
    const apres = await prisma.portailParentToken.findFirstOrThrow({ where: { id: rec.id } });
    expect(apres.actif).toBe(false);
    await expect(getPortailData(rec.token)).rejects.toThrow(/invalide|désactivé/i);
  });
});

describe('Portail parent — audit', () => {
  it('génération, rotation et révocation laissent une trace d’audit', async () => {
    const gen = await prisma.auditLog.count({ where: { etablissement_id: etabId, action: 'PORTAIL_GENERATE' } });
    const rev = await prisma.auditLog.count({ where: { etablissement_id: etabId, action: 'PORTAIL_REVOKE' } });
    // genererToken ×2 (dont 1 réutilisation, mais chaque appel audite) + regenererToken ×1.
    expect(gen).toBeGreaterThanOrEqual(3);
    expect(rev).toBeGreaterThanOrEqual(1);
  });
});

// ── Cahier de texte Phase 3 : devoirs à venir sur le portail ─────────────────
describe('Portail parent — devoirs (cahier de texte)', () => {
  it("getPortailData expose les devoirs à venir des classes de l'élève, pas les anciens", async () => {
    // Fixtures dédiées : année active + classe FR + inscription + devoirs.
    const anneeId = `pp-annee-${RUN}`, filId = `pp-fil-${RUN}`, classeId = `pp-classe-${RUN}`;
    const matId = `pp-mat-${RUN}`, inscId = `pp-insc-${RUN}`, userId = `pp-user-${RUN}`, persId = `pp-pers-${RUN}`;
    await prisma.configNotes.create({ data: { etablissement_id: etabId } });
    await prisma.anneeScolaire.create({
      data: { id: anneeId, etablissement_id: etabId, libelle: '2025-2026', active: true, date_debut: new Date('2025-10-01'), date_fin: new Date('2026-07-31') },
    });
    await prisma.filiere.create({ data: { id: filId, etablissement_id: etabId, code: 'FR', nom_fr: 'Française', langue: 'fr', sens_ecriture: 'LTR' } });
    await prisma.classe.create({ data: { id: classeId, etablissement_id: etabId, annee_scolaire_id: anneeId, nom_fr: 'CM2 A', filiere_id: filId } });
    await prisma.matiere.create({ data: { id: matId, etablissement_id: etabId, nom_fr: 'Grammaire', filiere_id: filId } });
    await prisma.inscription.create({ data: { id: inscId, eleve_id: eleveId, annee_scolaire_id: anneeId, statut: 'actif' } });
    await prisma.inscriptionClasse.create({ data: { inscription_id: inscId, filiere_id: filId, classe_id: classeId } });
    const role = await prisma.role.upsert({ where: { libelle_fr: 'professeur' }, update: {}, create: { libelle_fr: 'professeur' } });
    await prisma.utilisateur.create({ data: { id: userId, etablissement_id: etabId, role_id: role.id, nom_fr: 'Prof', identifiant: `pp-u-${RUN}`, mot_de_passe: 'x' } });
    await prisma.personnel.create({ data: { id: persId, utilisateur_id: userId } });

    const demain = new Date(Date.now() + 86_400_000);
    const ilYAUnMois = new Date(Date.now() - 30 * 86_400_000);
    await prisma.devoir.createMany({
      data: [
        { etablissement_id: etabId, annee_scolaire_id: anneeId, classe_id: classeId, matiere_id: matId, personnel_id: persId,
          donne_le: new Date(), pour_le: demain, consigne: 'Conjuguer être et avoir', type: 'LECON' },
        // Ancien devoir (échéance il y a un mois) → hors fenêtre du portail.
        { etablissement_id: etabId, annee_scolaire_id: anneeId, classe_id: classeId, matiere_id: matId, personnel_id: persId,
          donne_le: ilYAUnMois, pour_le: ilYAUnMois, consigne: 'Vieux devoir', type: 'EXERCICE' },
      ],
    });

    const rec = await genererToken(etabId, eleveId, acteur);
    const data = await getPortailData(rec.token);
    expect(data.devoirs).toHaveLength(1);
    expect(data.devoirs[0].consigne).toContain('Conjuguer');
    expect(data.devoirs[0].matiere.nom_fr).toBe('Grammaire');
    expect(data.devoirs[0].matiere.filiere).toBe('FR');
  });
});
