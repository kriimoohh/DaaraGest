import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '../../config/database';
import { signerQr } from '../../utils/qrSecret';
import { scanQR } from './pointage.service';

// Régression : la borne de pointage refusait les cartes du personnel imprimées depuis Documents
// (contenu SIGNÉ) car elle n'acceptait qu'un jeton brut ; et la signature n'était jamais vérifiée.

const RUN = randomUUID().slice(0, 6).toUpperCase();
const etab = `scan-etab-${RUN}`, autre = `scan-autre-${RUN}`, user = `scan-user-${RUN}`, pers = `scan-pers-${RUN}`;
const token = randomUUID();
const user2 = `scan-user2-${RUN}`, pers2 = `scan-pers2-${RUN}`, token2 = randomUUID();

beforeAll(async () => {
  await prisma.etablissement.createMany({ data: [
    { id: etab, nom_fr: 'Scan', code: `SC${RUN.slice(0, 4)}` },
    { id: autre, nom_fr: 'Autre', code: `SO${RUN.slice(0, 4)}` },
  ] });
  const role = await prisma.role.upsert({ where: { libelle_fr: 'professeur' }, update: {}, create: { libelle_fr: 'professeur' } });
  await prisma.utilisateur.create({ data: { id: user, etablissement_id: etab, role_id: role.id, nom_fr: 'Prof', identifiant: `scan-${RUN}`, mot_de_passe: 'x' } });
  await prisma.personnel.create({ data: { id: pers, utilisateur_id: user, qr_token: token } });
  await prisma.utilisateur.create({ data: { id: user2, etablissement_id: etab, role_id: role.id, nom_fr: 'Collègue', identifiant: `scan2-${RUN}`, mot_de_passe: 'x' } });
  await prisma.personnel.create({ data: { id: pers2, utilisateur_id: user2, qr_token: token2 } });
});

afterAll(async () => {
  await prisma.presencePersonnel.deleteMany({ where: { personnel_id: { in: [pers, pers2] } } });
  await prisma.personnel.deleteMany({ where: { id: { in: [pers, pers2] } } });
  await prisma.utilisateur.deleteMany({ where: { id: { in: [user, user2] } } });
  await prisma.etablissement.deleteMany({ where: { id: { in: [etab, autre] } } });
  await prisma.$disconnect();
});

describe('Borne de pointage — cartes signées', () => {
  it('une carte imprimée (contenu signé) pointe l\'arrivée', async () => {
    const r = await scanQR(signerQr({ type: 'professeur', id: pers, token, ets: etab }));
    expect(r.action).toBe('arrivee');
  });
  it('le jeton brut (QR de la page Pointage) reste accepté', async () => {
    expect((await scanQR(token)).action).toBe('depart');
  });
  it('carte falsifiée, carte d\'un autre établissement ou carte élève : refusées', async () => {
    const [, sig] = signerQr({ type: 'professeur', token, ets: etab }).split('.');
    // Carte recopiée en remplaçant le jeton par celui d'un collègue de la même école.
    const falsifie = Buffer.from(JSON.stringify({ type: 'professeur', token: token2, ets: etab })).toString('base64url');
    await expect(scanQR(`${falsifie}.${sig}`)).rejects.toThrow('invalide');
    await expect(scanQR(signerQr({ type: 'professeur', token, ets: autre }))).rejects.toThrow('invalide');
    await expect(scanQR(signerQr({ type: 'eleve', id: 'x', token, ets: etab }))).rejects.toThrow('invalide');
  });
  it('établissement suspendu : la borne refuse le pointage', async () => {
    await prisma.etablissement.update({ where: { id: etab }, data: { actif: false } });
    try {
      await expect(scanQR(token2)).rejects.toThrow('suspendu');
    } finally {
      await prisma.etablissement.update({ where: { id: etab }, data: { actif: true } });
    }
  });
});
