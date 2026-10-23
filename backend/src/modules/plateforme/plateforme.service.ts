import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { logAction } from '../../utils/audit';
import { viderCacheSessions } from '../../utils/sessions';
import { assertMotDePasseValide } from '../../utils/passwordPolicy';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { ROLES } from '../../config/roles';
import { CreerEtablissementInput, ModifierEtablissementInput } from './plateforme.schema';

// Plateforme multi-établissement : création, liste et suspension des écoles par le super-admin.
// Les données de départ reprennent celles du seed de production (prisma/seed-prod.cjs) : filières,
// niveaux, configuration des notes et, en option, le référentiel de matières (prisma/data).

const FILIERES = {
  FR: { nom_fr: 'Filière française', nom_ar: null, langue: 'fr', sens_ecriture: 'LTR', couleur: '#DDE2F1', ordre: 0 },
  AR: { nom_fr: 'Filière arabe', nom_ar: 'الشعبة العربية', langue: 'ar', sens_ecriture: 'RTL', couleur: '#DCEBDF', ordre: 1 },
  EN: { nom_fr: 'Filière anglaise', nom_ar: null, langue: 'en', sens_ecriture: 'LTR', couleur: '#F1E6D6', ordre: 2 },
} as const;

const NIVEAUX = [
  'Petite Section', 'Moyenne Section', 'Grande Section', 'CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2',
  '6e', '5e', '4e', '3e', 'Seconde', 'Première', 'Terminale',
];

type Referentiel = {
  domaines: { code: string; nom_fr: string; ordre: number }[];
  matieres: { nom_fr: string; nom_ar: string; code_court: string; domaine_code: string; filiere: string; type_note: string; ordre_bulletin: number }[];
};
// Lu au moment de l'appel (le fichier vit dans prisma/, hors du code compilé ; présent dans l'image Docker).
const lireReferentiel = (): Referentiel =>
  JSON.parse(readFileSync(join(process.cwd(), 'prisma/data/lgm-matieres.json'), 'utf8'));

/** Mot de passe temporaire conforme à la politique ; à changer à la première connexion. */
export function genererMotDePasseTemporaire(): string {
  const mdp = randomBytes(12).toString('base64').replace(/[/+=]/g, '').slice(0, 12) + 'A1a!';
  assertMotDePasseValide(mdp);
  return mdp;
}

export async function listerEtablissements() {
  const [etabs, utilisateurs, eleves] = await Promise.all([
    prisma.etablissement.findMany({
      select: { id: true, nom_fr: true, code: true, adresse: true, telephone: true, email: true, actif: true, created_at: true },
      orderBy: { created_at: 'asc' },
    }),
    prisma.utilisateur.groupBy({ by: ['etablissement_id'], where: { actif: true }, _count: { _all: true } }),
    prisma.eleve.groupBy({ by: ['etablissement_id'], _count: { _all: true } }),
  ]);
  const nb = (rows: { etablissement_id: string; _count: { _all: number } }[], id: string) =>
    rows.find(r => r.etablissement_id === id)?._count._all ?? 0;
  return etabs.map(e => ({ ...e, nb_utilisateurs: nb(utilisateurs, e.id), nb_eleves: nb(eleves, e.id) }));
}

export async function creerEtablissement(input: CreerEtablissementInput, acteur: { id: string; etablissement_id: string }) {
  if (await prisma.etablissement.findFirst({ where: { code: { equals: input.code, mode: 'insensitive' } } })) {
    throw new ConflictError(`Le code « ${input.code} » est déjà utilisé par un autre établissement`);
  }
  if (input.annee && input.annee.date_fin <= input.annee.date_debut) {
    throw new ValidationError("La fin de l'année scolaire doit suivre son début");
  }
  const roleAdmin = await prisma.role.findUnique({ where: { libelle_fr: ROLES.ADMIN } });
  if (!roleAdmin) throw new NotFoundError('Rôle admin introuvable');

  const motDePasse = genererMotDePasseTemporaire();
  const hash = await bcrypt.hash(motDePasse, 10);
  const referentiel = input.referentiel_matieres ? lireReferentiel() : null;

  const etab = await prisma.$transaction(async (tx) => {
    const etab = await tx.etablissement.create({
      data: {
        nom_fr: input.nom_fr, code: input.code, devise: 'FCFA',
        adresse: input.adresse || null, telephone: input.telephone || null, email: input.email || null,
      },
    });
    await tx.configNotes.create({ data: { etablissement_id: etab.id, note_max: 20, note_min: 0, nb_periodes: 3 } });
    await tx.filiere.createMany({
      data: input.filieres.map(code => ({ etablissement_id: etab.id, code, ...FILIERES[code] })),
    });
    await tx.niveau.createMany({
      data: NIVEAUX.map((libelle, i) => ({ etablissement_id: etab.id, libelle, ordre: i + 1 })),
    });
    if (input.annee) {
      await tx.anneeScolaire.create({
        data: {
          etablissement_id: etab.id, libelle: input.annee.libelle, active: true,
          date_debut: new Date(`${input.annee.date_debut}T00:00:00Z`), date_fin: new Date(`${input.annee.date_fin}T00:00:00Z`),
        },
      });
    }
    if (referentiel) {
      await tx.domaine.createMany({
        data: referentiel.domaines.map(d => ({ etablissement_id: etab.id, code: d.code, nom_fr: d.nom_fr, ordre: d.ordre, actif: true })),
      });
      const [filieres, domaines] = await Promise.all([
        tx.filiere.findMany({ where: { etablissement_id: etab.id }, select: { id: true, code: true } }),
        tx.domaine.findMany({ where: { etablissement_id: etab.id }, select: { id: true, code: true } }),
      ]);
      const filiereId = new Map(filieres.map(f => [f.code, f.id]));
      const domaineId = new Map(domaines.map(d => [d.code, d.id]));
      await tx.matiere.createMany({
        data: referentiel.matieres
          .filter(m => filiereId.has(m.filiere))
          .map(m => ({
            etablissement_id: etab.id, nom_fr: m.nom_fr, nom_ar: m.nom_ar || null, filiere_id: filiereId.get(m.filiere)!,
            coeff_defaut: new Prisma.Decimal(1), note_min: new Prisma.Decimal(0), ordre_bulletin: m.ordre_bulletin,
            code_court: m.code_court, type_note: m.type_note, domaine_id: domaineId.get(m.domaine_code) ?? null, active: true,
          })),
      });
    }
    await tx.utilisateur.create({
      data: {
        etablissement_id: etab.id, role_id: roleAdmin.id, identifiant: input.admin.identifiant, mot_de_passe: hash,
        nom_fr: input.admin.nom_fr, prenom_fr: input.admin.prenom_fr || null, must_change_password: true,
      },
    });
    return etab;
  }, { timeout: 30_000 });

  // Tracé dans l'établissement du super-admin (c'est lui qui agit).
  await logAction(acteur.etablissement_id, acteur.id, 'CREATE', 'Etablissement', etab.id, { nom: etab.nom_fr, code: etab.code });
  return {
    etablissement: { id: etab.id, nom_fr: etab.nom_fr, code: etab.code },
    // Affiché UNE seule fois au super-admin, à transmettre à l'école ; changement imposé à la 1re connexion.
    admin: { identifiant: input.admin.identifiant, mot_de_passe_temporaire: motDePasse },
  };
}

export async function modifierEtablissement(id: string, input: ModifierEtablissementInput, acteur: { id: string; etablissement_id: string }) {
  const etab = await prisma.etablissement.findUnique({ where: { id } });
  if (!etab) throw new NotFoundError('Établissement introuvable');
  if (input.actif === false && id === acteur.etablissement_id) {
    throw new ValidationError('Vous ne pouvez pas suspendre votre propre établissement');
  }
  const maj = await prisma.etablissement.update({
    where: { id },
    data: { ...(input.actif !== undefined ? { actif: input.actif } : {}), ...(input.nom_fr ? { nom_fr: input.nom_fr } : {}) },
    select: { id: true, nom_fr: true, code: true, actif: true },
  });
  // Suspension / réactivation : les sessions de l'école sont réévaluées tout de suite.
  if (input.actif !== undefined && input.actif !== etab.actif) viderCacheSessions();
  await logAction(acteur.etablissement_id, acteur.id, 'UPDATE', 'Etablissement', id, {
    nom: maj.nom_fr, code: maj.code, ...(input.actif !== undefined ? { actif: input.actif } : {}),
  });
  return maj;
}
