// Plafond des ÉCHECS de connexion par adresse IP (audit SenInit DG-AUTH-003 / DG-AUTH-004).
//
// Avant : le login était limité à 5 requêtes par minute et par IP, TOUTES tentatives confondues. Un
// établissement sort par une seule IP publique : à l'heure d'arrivée du personnel, la 6ᵉ connexion
// valide de la minute était refusée. Désormais seuls les ÉCHECS comptent, avec un plafond large par IP
// (pulvérisation d'identifiants depuis un même réseau) ; la protection d'un compte précis est assurée
// par le verrouillage progressif du compte et par la limite par (IP, identifiant) de la route.
// Les connexions réussies ne comptent pas : 30 enseignants qui arrivent ensemble ne se bloquent pas.

const FENETRE_MS = 10 * 60_000;
export const MAX_ECHECS_PAR_IP = 30;

const echecs = new Map<string, { n: number; fin: number }>();

export function ipBloquee(ip: string, maintenant = Date.now()): boolean {
  const e = echecs.get(ip);
  if (!e) return false;
  if (e.fin <= maintenant) { echecs.delete(ip); return false; }
  return e.n >= MAX_ECHECS_PAR_IP;
}

export function noterEchec(ip: string, maintenant = Date.now()): void {
  if (echecs.size > 5000) for (const [k, v] of echecs) if (v.fin <= maintenant) echecs.delete(k); // purge
  const e = echecs.get(ip);
  if (!e || e.fin <= maintenant) echecs.set(ip, { n: 1, fin: maintenant + FENETRE_MS });
  else e.n += 1;
}

export function reinitialiserEchecs(): void { echecs.clear(); }
