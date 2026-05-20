import prisma from '../config/database';
import { Prisma } from '@prisma/client';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export async function logAction(
  etablissement_id: string,
  utilisateur_id: string,
  action: AuditAction,
  entite: string,
  entite_id: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { etablissement_id, utilisateur_id, action, entite, entite_id, details: (details ?? {}) as Prisma.InputJsonValue },
    });
  } catch (err) {
    // Non-bloquant : un échec de log ne doit pas faire échouer l'opération métier,
    // mais on émet sur stderr pour ne pas perdre silencieusement la trace.
    console.warn('[audit] échec d\'écriture du log', { action, entite, entite_id, err: (err as Error).message });
  }
}
