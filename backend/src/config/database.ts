import { AsyncLocalStorage } from 'node:async_hooks';
import { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

// ─── Isolation des établissements par la base (RLS PostgreSQL) ──────────────────
//
// Chaque table portant `etablissement_id` a une politique RLS (migration
// 20261024000000_rls_isolation) : un rôle `daaragest_app` ne voit et n'écrit que les lignes
// dont `etablissement_id` = current_setting('app.etab_id'). Le compte de connexion (superutilisateur)
// contourne la RLS ; on bascule donc sur ce rôle, LE TEMPS D'UNE TRANSACTION, dès qu'une requête HTTP
// authentifiée a un établissement :
//   - l'établissement courant est porté par un AsyncLocalStorage (rempli par authMiddleware) ;
//   - chaque requête Prisma est enveloppée : BEGIN ; set_config(app.etab_id, role) ; requête ; COMMIT ;
//   - les transactions du code ($transaction) posent les mêmes réglages en tête de transaction.
// Hors contexte (connexion, portail parent, scan public, seed, scripts, super-admin plateforme via
// horsIsolation) : comportement inchangé, les filtres applicatifs `where: { etablissement_id }` restent
// la première barrière ; la RLS est la seconde (défense en profondeur).
//
// Interrupteur d'urgence : RLS_ACTIF=false désactive l'enveloppe (les politiques restent en base mais
// le superutilisateur les contourne → comportement d'avant).

export interface ContexteTenant { etablissement_id?: string; enTransaction?: boolean }
export const contexteTenant = new AsyncLocalStorage<ContexteTenant>();

export const ROLE_APP = 'daaragest_app';
const rlsActif = () => process.env.RLS_ACTIF !== 'false';

/**
 * Ouvre un contexte (vide) pour chaque requête HTTP ; authMiddleware y inscrit l'établissement.
 * Enregistré en PREMIER hook : la suite des hooks et le handler s'exécutent dans ce contexte.
 */
export function brancherContexteTenant(app: FastifyInstance): void {
  app.addHook('onRequest', (_req, _reply, done) => contexteTenant.run({}, done));
}

/** Inscrit l'établissement de l'utilisateur authentifié dans le contexte de la requête. */
export function definirTenant(etablissement_id: string): void {
  const s = contexteTenant.getStore();
  if (s) s.etablissement_id = etablissement_id;
}

/** Exécute `fn` sans isolation (super-admin plateforme : lecture/écriture multi-établissements). */
export function horsIsolation<T>(fn: () => Promise<T>): Promise<T> {
  return contexteTenant.run({}, fn);
}

const base = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

const reglages = (etablissement_id: string) =>
  base.$executeRaw`SELECT set_config('app.etab_id', ${etablissement_id}, true), set_config('role', ${ROLE_APP}, true)`;

const tenantCourant = (): string | null => {
  const s = contexteTenant.getStore();
  return rlsActif() && s?.etablissement_id && !s.enTransaction ? s.etablissement_id : null;
};

const etendu = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        const etab = tenantCourant();
        if (!etab) return query(args);
        const [, resultat] = await base.$transaction([reglages(etab), query(args)]);
        return resultat;
      },
    },
  },
});

type Tx = Prisma.TransactionClient;
type OptionsTx = { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel };

// $transaction : en contexte établissement, les réglages sont posés en TÊTE de la transaction et les
// requêtes qu'elle contient ne sont pas ré-enveloppées (enTransaction).
function transaction(arg: unknown, options?: OptionsTx): Promise<unknown> {
  const etab = tenantCourant();
  if (!etab) return (etendu.$transaction as (a: unknown, o?: OptionsTx) => Promise<unknown>)(arg, options);
  const store = { ...contexteTenant.getStore(), enTransaction: true };
  if (typeof arg === 'function') {
    return contexteTenant.run(store, () => base.$transaction(async (tx: Tx) => {
      await tx.$executeRaw`SELECT set_config('app.etab_id', ${etab}, true), set_config('role', ${ROLE_APP}, true)`;
      return (arg as (tx: Tx) => Promise<unknown>)(tx);
    }, options));
  }
  return contexteTenant.run(store, async () => {
    const resultats = await base.$transaction([reglages(etab), ...(arg as Prisma.PrismaPromise<unknown>[])], options);
    return resultats.slice(1);
  });
}

// Même type que PrismaClient pour tout le code existant ; seules les requêtes et $transaction changent.
const prisma = new Proxy(etendu, {
  get(cible, prop, recepteur) {
    if (prop === '$transaction') return transaction;
    return Reflect.get(cible, prop, recepteur);
  },
}) as unknown as PrismaClient;

export default prisma;
