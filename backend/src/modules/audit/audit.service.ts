import prisma from '../../config/database';
import { resolveAuditAction, describeAuditFr, resumeDetails } from '../../utils/audit-actions';

export interface AuditFiltres {
  page?: number;
  limit?: number;
  action?: string;
  entite?: string;
  utilisateur_id?: string;
  date_debut?: string;
  date_fin?: string;
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

  return {
    total, page, limit,
    data: rows.map(r => {
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
        details: r.details,
        utilisateur_id: r.utilisateur_id,
        acteur: u ? `${u.prenom_fr} ${u.nom_fr}`.trim() : r.utilisateur_id,
        acteur_role: u?.role?.libelle_fr ?? null,
      };
    }),
  };
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
