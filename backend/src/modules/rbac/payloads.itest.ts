import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import { listerPersonnel, getPersonnel } from '../personnel/personnel.service';
import { getScansDuJour } from '../pointage/pointage.service';
import { listerDemandes } from '../demandes-absence-personnel/demandes-absence.service';

// ─────────────────────────────────────────────────────────────────────────────
// Tests ANTI-FUITE de payloads (audit RBAC 2026-07-18) : la matrice rbac.test.ts
// verrouille QUI appelle QUELLE route ; ces tests verrouillent CE QUE la route
// renvoie. Règles : le hash `mot_de_passe` ne sort JAMAIS ; `salaire_base`,
// `cni` et `qr_token` (Personnel) sont réservés aux rôles de gestion — et
// absents des endpoints publics (scans du jour du kiosque scanner).
// ─────────────────────────────────────────────────────────────────────────────

const RUN = randomUUID().slice(0, 8);
const etabId = `pl-etab-${RUN}`;
const userId = `pl-user-${RUN}`;
const persId = `pl-pers-${RUN}`;
const SALAIRE = '999888.77';
const CNI = `CNI-SECRET-${RUN}`;
const QR = `qr-secret-${RUN}`;
const HASH = `$2a$10$hash-secret-${RUN}`;

const contient = (objet: unknown, aiguille: string) => JSON.stringify(objet).includes(aiguille);

async function nettoyer() {
  await prisma.demandeAbsencePersonnel.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.presencePersonnel.deleteMany({ where: { personnel_id: persId } });
  await prisma.personnel.deleteMany({ where: { id: persId } });
  await prisma.utilisateur.deleteMany({ where: { etablissement_id: etabId } });
  await prisma.etablissement.deleteMany({ where: { id: etabId } });
}

beforeAll(async () => {
  await nettoyer();
  await prisma.etablissement.create({ data: { id: etabId, nom_fr: 'École Payloads', code: `PL${RUN.slice(0, 4).toUpperCase()}` } });
  const role = await prisma.role.upsert({ where: { libelle_fr: 'professeur' }, update: {}, create: { libelle_fr: 'professeur' } });
  await prisma.utilisateur.create({
    data: { id: userId, etablissement_id: etabId, role_id: role.id, nom_fr: 'Sarr', prenom_fr: 'Modou', identifiant: `pl-u-${RUN}`, mot_de_passe: HASH },
  });
  await prisma.personnel.create({
    data: { id: persId, utilisateur_id: userId, salaire_base: SALAIRE, cni: CNI, qr_token: QR },
  });
  const aujourdhui = new Date();
  await prisma.presencePersonnel.create({
    data: {
      personnel_id: persId, statut: 'present', heure_arrivee: '08:01', source: 'qr',
      date: new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate()),
    },
  });
  await prisma.demandeAbsencePersonnel.create({
    data: {
      etablissement_id: etabId, personnel_id: persId, motif: 'Motif test', type_absence: 'maladie',
      date_debut: aujourdhui, date_fin: aujourdhui,
    },
  });
});

afterAll(async () => { await nettoyer(); await prisma.$disconnect(); });

describe('Payloads — le hash de mot de passe ne sort JAMAIS', () => {
  it('listerPersonnel (tous rôles) et getPersonnel', async () => {
    for (const role of ['professeur', 'pointeur', 'gestionnaire', 'directeur', 'admin']) {
      const liste = await listerPersonnel(etabId, role);
      expect(contient(liste, HASH), `hash exposé via listerPersonnel(${role})`).toBe(false);
      const detail = await getPersonnel(persId, etabId, role);
      expect(contient(detail, HASH), `hash exposé via getPersonnel(${role})`).toBe(false);
    }
  });

  it('listerDemandes (demandes d\'absence personnel)', async () => {
    const demandes = await listerDemandes(etabId);
    expect(demandes.length).toBeGreaterThan(0);
    expect(contient(demandes, HASH)).toBe(false);
  });
});

describe('Payloads — fiche RH (salaire, CNI, QR) réservée à la gestion', () => {
  it('professeur/pointeur : annuaire seulement (ni salaire, ni CNI, ni qr_token)', async () => {
    for (const role of ['professeur', 'pointeur']) {
      const liste = await listerPersonnel(etabId, role);
      const detail = await getPersonnel(persId, etabId, role);
      for (const secret of [SALAIRE, CNI, QR]) {
        expect(contient(liste, secret), `« ${secret} » exposé à ${role} (liste)`).toBe(false);
        expect(contient(detail, secret), `« ${secret} » exposé à ${role} (détail)`).toBe(false);
      }
      // L'annuaire reste utile : l'identité est bien là.
      expect(contient(detail, 'Sarr')).toBe(true);
    }
  });

  it('gestionnaire : la fiche RH complète reste disponible', async () => {
    const detail = await getPersonnel(persId, etabId, 'gestionnaire');
    expect(contient(detail, SALAIRE)).toBe(true);
    expect(contient(detail, CNI)).toBe(true);
  });
});

describe('Payloads — endpoint PUBLIC scans du jour (kiosque scanner)', () => {
  it('ne renvoie que l\'identité et les heures — jamais salaire/CNI/qr_token/hash', async () => {
    const scans = await getScansDuJour(etabId);
    expect(scans.length).toBeGreaterThan(0);
    expect(contient(scans, 'Sarr')).toBe(true);
    for (const secret of [SALAIRE, CNI, QR, HASH]) {
      expect(contient(scans, secret), `« ${secret} » exposé publiquement via scans-jour`).toBe(false);
    }
  });
});
