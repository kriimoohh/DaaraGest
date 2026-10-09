import prisma from '../../config/database';
import { resolveAuditAction, describeAuditFr, resumeDetails } from '../../utils/audit-actions';
import { collecterReferences, construirePhrase, contexteVide, type ContexteNoms, type EntreeAudit } from './audit-phrases';

export interface AuditFiltres {
  page?: number;
  limit?: number;
  action?: string;
  entite?: string;
  utilisateur_id?: string;
  date_debut?: string;
  date_fin?: string;
}

const nomComplet = (p?: string | null, n?: string | null) => `${p ?? ''} ${n ?? ''}`.trim();

/** Résout, en quelques requêtes groupées, les noms cités par les entrées d'une page. */
async function chargerContexteNoms(entrees: EntreeAudit[]): Promise<ContexteNoms> {
  const ref = collecterReferences(entrees);
  const ctx = contexteVide();
  const ids = (s: Set<string>) => [...s];

  // 1) Entités « intermédiaires » : paiement / bulletin / inscription → élève (+ infos).
  const [paiements, bulletins, inscriptions] = await Promise.all([
    ref.paiements.size ? prisma.paiementEleve.findMany({ where: { id: { in: ids(ref.paiements) } }, select: { id: true, eleve_id: true, recu_numero: true, type: true, montant: true } }) : [],
    ref.bulletins.size ? prisma.bulletin.findMany({ where: { id: { in: ids(ref.bulletins) } }, select: { id: true, eleve_id: true, periode: true } }) : [],
    ref.inscriptions.size ? prisma.inscription.findMany({ where: { id: { in: ids(ref.inscriptions) } }, select: { id: true, eleve_id: true } }) : [],
  ]);
  for (const p of paiements) { ctx.paiements.set(p.id, { eleve_id: p.eleve_id, recu: p.recu_numero, type: p.type, montant: String(p.montant) }); ref.eleves.add(p.eleve_id); }
  for (const b of bulletins) { ctx.bulletins.set(b.id, { eleve_id: b.eleve_id, periode: b.periode }); ref.eleves.add(b.eleve_id); }
  for (const i of inscriptions) { ctx.inscriptions.set(i.id, i.eleve_id); ref.eleves.add(i.eleve_id); }

  // 2) Noms.
  const [eleves, classes, matieres, annees, personnels, utilisateurs, roles] = await Promise.all([
    ref.eleves.size ? prisma.eleve.findMany({ where: { id: { in: ids(ref.eleves) } }, select: { id: true, nom_fr: true, prenom_fr: true, matricule: true } }) : [],
    ref.classes.size ? prisma.classe.findMany({ where: { id: { in: ids(ref.classes) } }, select: { id: true, nom_fr: true } }) : [],
    ref.matieres.size ? prisma.matiere.findMany({ where: { id: { in: ids(ref.matieres) } }, select: { id: true, nom_fr: true } }) : [],
    ref.annees.size ? prisma.anneeScolaire.findMany({ where: { id: { in: ids(ref.annees) } }, select: { id: true, libelle: true } }) : [],
    ref.personnels.size ? prisma.personnel.findMany({ where: { id: { in: ids(ref.personnels) } }, select: { id: true, utilisateur: { select: { nom_fr: true, prenom_fr: true } } } }) : [],
    ref.utilisateurs.size ? prisma.utilisateur.findMany({ where: { id: { in: ids(ref.utilisateurs) } }, select: { id: true, nom_fr: true, prenom_fr: true, identifiant: true } }) : [],
    ref.aRoles ? prisma.role.findMany({ select: { id: true, libelle_fr: true } }) : [],
  ]);
  for (const e of eleves) ctx.eleves.set(e.id, { nom: nomComplet(e.prenom_fr, e.nom_fr), matricule: e.matricule });
  for (const x of classes) ctx.classes.set(x.id, x.nom_fr);
  for (const x of matieres) ctx.matieres.set(x.id, x.nom_fr);
  for (const x of annees) ctx.annees.set(x.id, x.libelle);
  for (const x of personnels) ctx.personnels.set(x.id, nomComplet(x.utilisateur.prenom_fr, x.utilisateur.nom_fr));
  for (const x of utilisateurs) ctx.utilisateurs.set(x.id, { nom: nomComplet(x.prenom_fr, x.nom_fr), identifiant: x.identifiant });
  for (const x of roles) ctx.roles.set(x.id, x.libelle_fr);
  return ctx;
}

// Journal d'audit (« qui fait quoi ») — lecture paginée + filtrable, réservée à la
// direction. Résout le nom de l'acteur depuis Utilisateur.
export async function listerAuditLogs(etablissement_id: string, f: AuditFiltres) {
  const page = Math.max(1, f.page ?? 1);
  const limit = Math.min(200, Math.max(1, f.limit ?? 50));

  const where: Record<string, unknown> = { etablissement_id };
  if (f.action) where.action = f.action;
  if (f.entite) where.entite = f.entite;
  if (f.utilisateur_id) where.utilisateur_id = f.utilisateur_id;
  if (f.date_debut || f.date_fin) {
    where.created_at = {
      ...(f.date_debut ? { gte: new Date(f.date_debut) } : {}),
      // date_fin inclusive : borne à la fin de la journée.
      ...(f.date_fin ? { lte: new Date(`${f.date_fin}T23:59:59.999`) } : {}),
    };
  }

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  // Résolution des noms d'acteurs (une requête pour tous les ids de la page).
  const userIds = [...new Set(rows.map(r => r.utilisateur_id))];
  const users = await prisma.utilisateur.findMany({
    where: { id: { in: userIds } },
    select: { id: true, nom_fr: true, prenom_fr: true, identifiant: true, role: { select: { libelle_fr: true } } },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  // Phrases lisibles : noms résolus en lot (une requête par type, pas par ligne).
  const entrees: EntreeAudit[] = rows.map(r => ({
    action: resolveAuditAction(r.action, r.entite_id, r.details as Record<string, unknown> | null),
    entite: r.entite,
    entite_id: r.entite_id,
    details: (r.details as Record<string, unknown> | null) ?? null,
  }));
  const ctx = await chargerContexteNoms(entrees);

  return {
    total, page, limit,
    data: rows.map((r, i) => {
      const u = userMap.get(r.utilisateur_id);
      const details = r.details as Record<string, unknown> | null;
      // Action NORMALISÉE : les anciennes lignes (action générique + details.action)
      // remontent avec leur vraie action sémantique, comme les nouvelles.
      const action = resolveAuditAction(r.action, r.entite_id, details);
      return {
        id: r.id,
        created_at: r.created_at,
        action,
        entite: r.entite,
        entite_id: r.entite_id,
        // Résumé lisible des détails (données) : le front l'affiche à la place du
        // JSON brut, sous les libellés localisés action + entité.
        resume: resumeDetails(r.entite, r.entite_id, details),
        // Description FR : stockée pour les nouvelles lignes, recalculée à la volée
        // pour les anciennes (pas de backfill). Sert au repli et à l'export.
        description: r.description ?? describeAuditFr(r.action, r.entite, r.entite_id, details),
        // Phrase prête à traduire : { cle, params } (voir audit-phrases.ts).
        phrase: construirePhrase(entrees[i], ctx),
        utilisateur_id: r.utilisateur_id,
        acteur: u ? `${u.prenom_fr} ${u.nom_fr}`.trim() : r.utilisateur_id,
        acteur_role: u?.role?.libelle_fr ?? null,
      };
    }),
  };
}

// Personnes ayant agi dans le journal — pour le filtre « Qui ».
export async function listerActeursAudit(etablissement_id: string): Promise<{ id: string; nom: string; role: string | null }[]> {
  const rows = await prisma.auditLog.findMany({
    where: { etablissement_id }, select: { utilisateur_id: true }, distinct: ['utilisateur_id'],
  });
  const users = await prisma.utilisateur.findMany({
    where: { id: { in: rows.map(r => r.utilisateur_id) } },
    select: { id: true, nom_fr: true, prenom_fr: true, role: { select: { libelle_fr: true } } },
  });
  return users
    .map(u => ({ id: u.id, nom: nomComplet(u.prenom_fr, u.nom_fr), role: u.role?.libelle_fr ?? null }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

// Valeurs distinctes d'« entité » présentes dans le journal — pour peupler le filtre.
export async function listerEntitesAudit(etablissement_id: string): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    where: { etablissement_id },
    select: { entite: true },
    distinct: ['entite'],
    orderBy: { entite: 'asc' },
  });
  return rows.map(r => r.entite);
}
