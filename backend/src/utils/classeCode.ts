/**
 * Identité STABLE d'une classe entre les années scolaires.
 *
 * Deux classes de niveaux/sections identiques mais d'années différentes
 * (« CE1 A » 2024-2025 et « CE1 A » 2025-2026) partagent le même `code`. Cela
 * permet de reconnaître « la même » classe d'une année sur l'autre (rapports de
 * promotion, comparaisons d'effectifs…).
 *
 * Construction : nom_fr débarrassé de son marqueur de filière (« (AR) », «- Arabe »)
 * → MAJUSCULES sans accents, séparateurs en « - » → suffixe filière.
 *   « CE1 A »        + FR → "CE1-A-FR"
 *   « CE1 A (AR) »   + AR → "CE1-A-AR"
 *   « CE1 A - Arabe » + AR → "CE1-A-AR"
 */
export function classeCode(nom_fr: string, filiere: 'FR' | 'AR' | string): string {
  const base = nom_fr
    .replace(/\s*\(\s*ar\s*\)\s*$/i, '')      // suffixe "(AR)"
    .replace(/\s*-?\s*arabe\s*$/i, '')         // suffixe "- Arabe"
    .trim();
  const slug = base
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // accents
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const fil = filiere === 'AR' ? 'AR' : 'FR';
  return `${slug}-${fil}`;
}
