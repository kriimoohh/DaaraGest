import prisma from '../../config/database';

// Recherche d'école à la connexion (champ « Votre école ») : on ne publie JAMAIS la liste complète
// des écoles clientes — seulement les quelques écoles qui correspondent à au moins 3 caractères
// saisis. Écoles suspendues et établissement technique de la plateforme exclus.

export const RECHERCHE_MIN = 3;
export const RECHERCHE_MAX_RESULTATS = 8;

/** Minuscules, sans accents ni ponctuation, espaces simples : « F.I.C.A.A.M. — École » → « f i c a a m ecole ». */
export function normaliser(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Forme compacte (sans espaces) : « F.I.C.A.A.M. » et « ficaam » se rejoignent. */
const compact = (s: string) => normaliser(s).replace(/ /g, '');

type Ecole = { code: string; nom_fr: string };

/**
 * Écoles correspondant à la saisie : chaque mot saisi doit apparaître dans le nom (ou le code), en
 * ignorant accents, casse et ponctuation. Le code exact passe en tête, puis les noms qui commencent
 * par la saisie, puis l'ordre alphabétique.
 */
export function filtrerEcoles(ecoles: Ecole[], saisie: string, max = RECHERCHE_MAX_RESULTATS): Ecole[] {
  const q = normaliser(saisie);
  if (q.replace(/ /g, '').length < RECHERCHE_MIN) return [];
  const mots = q.split(' ');
  const qc = compact(saisie);
  const rang = (e: Ecole) => (compact(e.code) === qc ? 0 : normaliser(e.nom_fr).startsWith(q) ? 1 : 2);
  return ecoles
    .filter(e => {
      const nom = normaliser(e.nom_fr), nomc = compact(e.nom_fr), code = compact(e.code);
      return code.startsWith(qc) || nomc.includes(qc) || mots.every(m => nom.includes(m));
    })
    .sort((a, b) => rang(a) - rang(b) || a.nom_fr.localeCompare(b.nom_fr, 'fr'))
    .slice(0, max);
}

export async function rechercherEcoles(saisie: string): Promise<Ecole[]> {
  if (normaliser(saisie).replace(/ /g, '').length < RECHERCHE_MIN) return [];
  const ecoles = await prisma.etablissement.findMany({
    where: { actif: true, est_plateforme: false },
    select: { code: true, nom_fr: true },
  });
  return filtrerEcoles(ecoles, saisie);
}
