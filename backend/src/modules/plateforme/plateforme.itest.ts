import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { FastifyRequest } from 'fastify';
import prisma from '../../config/database';
import { creerEtablissement, modifierEtablissement, listerEtablissements } from './plateforme.service';
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
