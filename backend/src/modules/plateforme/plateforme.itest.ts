import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { FastifyRequest } from 'fastify';
import prisma from '../../config/database';
import { creerEtablissement, modifierEtablissement, listerEtablissements, listerAdmins, reinitialiserAdmin, journalPlateforme } from './plateforme.service';
import { creerEtablissementSchema } from './plateforme.schema';
import { login, getMe, creerRefreshToken, validerRefreshToken, CodeEtablissementRequisError } from '../auth/auth.service';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireSuperAdmin } from '../../middlewares/superAdmin.middleware';

// Multi-établissement (DB réelle) : création d'une école par le super-admin, identifiants uniques
// PAR école (connexion par code), suspension qui coupe connexions et sessions, garde super-admin.

const RUN = randomUUID().slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
const etabSA = `pf-sa-${RUN}`;
const superAdmin = `pf-user-sa-${RUN}`;
const simpleAdmin = `pf-user-adm-${RUN}`;
const codeA = `PA${RUN.slice(0, 4)}`;
const codeB = `PB${RUN.slice(0, 4)}`;
const crees: string[] = [];
const acteur = { id: superAdmin, etablissement_id: etabSA };

async function supprimerEtab(id: string) {
  const users = await prisma.utilisateur.findMany({ where: { etablissement_id: id }, select: { id: true } });
  await prisma.refreshToken.deleteMany({ where: { utilisateur_id: { in: users.map(u => u.id) } } });
  await prisma.auditLog.deleteMany({ where: { etablissement_id: id } });
  await prisma.matiere.deleteMany({ where: { etablissement_id: id } });
  await prisma.domaine.deleteMany({ where: { etablissement_id: id } });
  await prisma.niveau.deleteMany({ where: { etablissement_id: id } });
  await prisma.filiere.deleteMany({ where: { etablissement_id: id } });
  await prisma.anneeScolaire.deleteMany({ where: { etablissement_id: id } });
  await prisma.configNotes.deleteMany({ where: { etablissement_id: id } });
  await prisma.utilisateur.deleteMany({ where: { etablissement_id: id } });
  await prisma.etablissement.deleteMany({ where: { id } });
}

const entree = (code: string, extra: Record<string, unknown> = {}) => creerEtablissementSchema.parse({
  nom_fr: `École ${code}`, code, admin: { nom_fr: 'Directeur' }, ...extra,
});

beforeAll(async () => {
  await supprimerEtab(etabSA);
  await prisma.etablissement.create({ data: { id: etabSA, nom_fr: 'Plateforme', code: `PS${RUN.slice(0, 4)}` } });
  const roleAdmin = await prisma.role.upsert({ where: { libelle_fr: 'admin' }, update: {}, create: { libelle_fr: 'admin' } });
  await prisma.utilisateur.createMany({ data: [
    { id: superAdmin, etablissement_id: etabSA, role_id: roleAdmin.id, nom_fr: 'SA', identifiant: `sa-${RUN}`, mot_de_passe: 'x', super_admin: true },
    { id: simpleAdmin, etablissement_id: etabSA, role_id: roleAdmin.id, nom_fr: 'Adm', identifiant: `adm-${RUN}`, mot_de_passe: 'x' },
  ] });
});

afterAll(async () => {
  for (const id of crees) await supprimerEtab(id);
  await supprimerEtab(etabSA);
  await prisma.$disconnect();
});

describe('Création d\'un établissement', () => {
  let mdpA = '';

  it('crée l\'école, ses données de départ et un admin qui doit changer son mot de passe', async () => {
    const r = await creerEtablissement(entree(codeA, {
      filieres: ['FR'], referentiel_matieres: true,
      annee: { libelle: '2026-2027', date_debut: '2026-10-01', date_fin: '2027-07-31' },
    }), acteur);
    crees.push(r.etablissement.id);
    mdpA = r.admin.mot_de_passe_temporaire;
    const id = r.etablissement.id;
    expect(r.admin.identifiant).toBe('admin');
    expect(await prisma.configNotes.count({ where: { etablissement_id: id } })).toBe(1);
    expect((await prisma.filiere.findMany({ where: { etablissement_id: id } })).map(f => f.code)).toEqual(['FR']);
    expect(await prisma.niveau.count({ where: { etablissement_id: id } })).toBe(16);
    expect(await prisma.anneeScolaire.count({ where: { etablissement_id: id, active: true } })).toBe(1);
    // Référentiel filtré sur les filières choisies : aucune matière d'une filière absente.
    const matieres = await prisma.matiere.findMany({ where: { etablissement_id: id }, include: { filiere_ref: true } });
    expect(matieres.length).toBeGreaterThan(0);
    expect(matieres.every(m => m.filiere_ref.code === 'FR')).toBe(true);
    const admin = await prisma.utilisateur.findFirst({ where: { etablissement_id: id }, include: { role: true } });
    expect(admin?.role.libelle_fr).toBe('admin');
    expect(admin?.must_change_password).toBe(true);
    expect(admin?.super_admin).toBe(false);
    expect(await bcrypt.compare(mdpA, admin!.mot_de_passe)).toBe(true);
  });

  it('refuse un code déjà pris, même en casse différente', async () => {
    await expect(creerEtablissement(entree(codeA.toLowerCase()), acteur)).rejects.toThrow('déjà utilisé');
  });

  it('deux écoles peuvent avoir chacune un compte « admin » ; la connexion se fait par code école', async () => {
    const b = await creerEtablissement(entree(codeB), acteur);
    crees.push(b.etablissement.id);
    const [idA, idB] = crees;

    const a = await login('admin', mdpA, codeA.toLowerCase());
    expect(a.user.etablissement_id).toBe(idA);
    expect(a.user.etablissement_code).toBe(codeA);
    const lb = await login('admin', b.admin.mot_de_passe_temporaire, codeB);
    expect(lb.user.etablissement_id).toBe(idB);

    // Sans code : identifiant présent dans plusieurs écoles → code exigé.
    await expect(login('admin', mdpA)).rejects.toBeInstanceOf(CodeEtablissementRequisError);
    // Mauvais code (ou mot de passe d'une autre école) : refus générique.
    await expect(login('admin', mdpA, codeB)).rejects.toThrow('Identifiants incorrects');
    await expect(login('admin', mdpA, 'ZZZZZZ')).rejects.toThrow('Identifiants incorrects');
    // getMe expose l'école de rattachement.
    expect((await getMe(a.user.id)).etablissement.code).toBe(codeA);
  });

  it('un identifiant présent dans une seule école se connecte encore sans code (comptes existants)', async () => {
    const idA = crees[0];
    const role = await prisma.role.findUniqueOrThrow({ where: { libelle_fr: 'admin' } });
    await prisma.utilisateur.create({ data: {
      etablissement_id: idA, role_id: role.id, nom_fr: 'Unique', identifiant: `unique-${RUN}`,
      mot_de_passe: await bcrypt.hash('Unique-Pass-2026!x', 10),
    } });
    expect((await login(`unique-${RUN}`, 'Unique-Pass-2026!x')).user.etablissement_id).toBe(idA);
  });

  it('la liste des établissements donne les effectifs', async () => {
    const liste = await listerEtablissements();
    const a = liste.find(e => e.code === codeA)!;
    expect(a.nb_utilisateurs).toBe(2);
    expect(a.nb_eleves).toBe(0);
  });
});

describe('Suspension d\'un établissement', () => {
  const passe = async (payload: unknown) => {
    let code = 0;
    const reply = { status(c: number) { code = c; return this; }, send() { return this; } };
    await authMiddleware({ jwtVerify: async () => undefined, user: payload, url: '/api/v1/eleves' } as unknown as FastifyRequest, reply as never);
    return code;
  };

  it('coupe la connexion, les jetons d\'accès et le renouvellement ; la réactivation rétablit l\'accès', async () => {
    const idA = crees[0];
    const { payload, user } = await login(`unique-${RUN}`, 'Unique-Pass-2026!x', codeA);
    const rt = await creerRefreshToken(user.id, null);
    expect(await passe(payload)).toBe(0);

    await modifierEtablissement(idA, { actif: false }, acteur);
    expect(await passe(payload)).toBe(401);
    expect(await validerRefreshToken(rt)).toBeNull();
    await expect(login(`unique-${RUN}`, 'Unique-Pass-2026!x', codeA)).rejects.toThrow('suspendu');

    await modifierEtablissement(idA, { actif: true }, acteur);
    expect(await passe(payload)).toBe(0);
  });

  it('un super-admin ne peut pas suspendre son propre établissement', async () => {
    await expect(modifierEtablissement(etabSA, { actif: false }, acteur)).rejects.toThrow('propre établissement');
  });
});

describe('Garde super-admin', () => {
  const code = async (id: string) => {
    let c = 0;
    const reply = { status(x: number) { c = x; return this; }, send() { return this; } };
    await requireSuperAdmin({ user: { id } } as unknown as FastifyRequest, reply as never);
    return c;
  };
  it('le drapeau super_admin est exigé — un simple admin d\'établissement est refusé', async () => {
    expect(await code(superAdmin)).toBe(0);
    expect(await code(simpleAdmin)).toBe(403);
  });
});

// ── Console de plateforme (compte dédié, gestion des écoles, journal) ─────────────────────────
describe('Console de plateforme', () => {
  const comptePf = `pf-console-${RUN}`;
  let etabPf = '';

  beforeAll(async () => {
    etabPf = (await prisma.etablissement.findFirstOrThrow({ where: { est_plateforme: true } })).id;
    const roleAdmin = await prisma.role.findUniqueOrThrow({ where: { libelle_fr: 'admin' } });
    await prisma.utilisateur.create({ data: {
      id: comptePf, etablissement_id: etabPf, role_id: roleAdmin.id, nom_fr: 'Console', identifiant: `console-${RUN}`, mot_de_passe: 'x', super_admin: true,
    } });
  });
  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { utilisateur_id: comptePf } });
    await prisma.refreshToken.deleteMany({ where: { utilisateur_id: comptePf } });
    await prisma.utilisateur.deleteMany({ where: { id: comptePf } });
  });

  it('l\'établissement technique PLATEFORME n\'apparaît pas parmi les écoles et n\'est pas modifiable', async () => {
    expect((await listerEtablissements()).some(e => e.id === etabPf)).toBe(false);
    await expect(modifierEtablissement(etabPf, { actif: false }, acteur)).rejects.toThrow('introuvable');
    await expect(listerAdmins(etabPf)).rejects.toThrow('introuvable');
  });

  it('la liste donne classes et dernière connexion', async () => {
    const a = (await listerEtablissements()).find(e => e.code === codeA)!;
    expect(a).toHaveProperty('nb_classes');
    expect(a).toHaveProperty('derniere_connexion');
    expect(a.admins_bloques).toBe(0);
  });

  it('modifier une école : coordonnées et code (refusé s\'il est pris)', async () => {
    const idA = crees[0];
    await modifierEtablissement(idA, { adresse: 'Rue 10', telephone: '33 000 00 00' }, acteur);
    expect((await prisma.etablissement.findUnique({ where: { id: idA } }))?.adresse).toBe('Rue 10');
    await expect(modifierEtablissement(idA, { code: codeB }, acteur)).rejects.toThrow('déjà utilisé');
  });

  it('réinitialiser l\'admin d\'une école : nouveau mot de passe, changement imposé, sessions coupées, verrou levé ; tracé au journal de la plateforme', async () => {
    const idB = crees[1];
    const admins = await listerAdmins(idB);
    expect(admins.map(a => a.identifiant)).toEqual(['admin']);
    const cible = admins[0].id;
    await prisma.utilisateur.update({ where: { id: cible }, data: { tentatives_connexion: 9, verrouille_jusqu: new Date(Date.now() + 3_600_000) } });
    const rt = await creerRefreshToken(cible, null);
    const r = await reinitialiserAdmin(idB, cible, { id: comptePf, etablissement_id: etabPf });
    expect(r.code).toBe(codeB);
    expect(await validerRefreshToken(rt)).toBeNull();
    const u = await prisma.utilisateur.findUniqueOrThrow({ where: { id: cible } });
    expect(u.must_change_password).toBe(true);
    expect(u.verrouille_jusqu).toBeNull();
    expect((await login('admin', r.mot_de_passe_temporaire, codeB)).user.id).toBe(cible);
    // Un utilisateur d'une AUTRE école n'est pas réinitialisable via cette école.
    await expect(reinitialiserAdmin(crees[0], cible, { id: comptePf, etablissement_id: etabPf })).rejects.toThrow('introuvable');

    const journal = await journalPlateforme(etabPf);
    const ligne = journal.find(l => l.utilisateur_id === comptePf && l.action === 'PASSWORD_RESET');
    expect(ligne?.acteur).toBe('Console');
    // Le journal de la plateforme ne contient pas celui des écoles (et inversement).
    expect(await prisma.auditLog.count({ where: { etablissement_id: idB, utilisateur_id: comptePf } })).toBe(0);
  });

  it('un compte plateforme n\'accède qu\'à la console et à ses routes de compte', async () => {
    const payload = { id: comptePf, role: 'admin', etablissement_id: etabPf, langue: 'fr', theme: 'light', doit_changer_mdp: false, tv: 0 };
    const code = async (url: string) => {
      let c = 0;
      const reply = { status(x: number) { c = x; return this; }, send() { return this; } };
      await authMiddleware({ jwtVerify: async () => undefined, user: payload, url } as unknown as FastifyRequest, reply as never);
      return c;
    };
    expect(await code('/api/v1/plateforme/etablissements')).toBe(0);
    expect(await code('/api/v1/auth/me')).toBe(0);
    expect(await code('/api/v1/eleves')).toBe(403);
    expect(await code('/api/v1/finances/paiements-eleves')).toBe(403);
  });
});
