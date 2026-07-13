import i18n from '../i18n';

// Formatage des dates/nombres selon la langue d'INTERFACE (fr/ar/en).
// Pour l'arabe, `-u-nu-latn` conserve les chiffres occidentaux (usage local
// au Sénégal) tout en traduisant mois et jours.
// Les templates d'impression (listes PDF, CSV) restent volontairement en
// fr-FR : ce sont des documents officiels — ne pas utiliser ces helpers là-bas.
export function appLocale(): string {
  const lng = i18n.language ?? 'fr';
  return lng.startsWith('ar') ? 'ar-u-nu-latn' : lng.startsWith('en') ? 'en-GB' : 'fr-FR';
}

export function fmtDate(d: string | number | Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(d).toLocaleDateString(appLocale(), opts);
}

export function fmtNumber(n: number): string {
  return n.toLocaleString(appLocale());
}

// Nom du mois 1-12 (ex. en-têtes de calendrier, périodes de paiement).
// Intl renvoie les mois français en minuscule ; on capitalise pour les titres
// (sans effet en arabe).
export function monthName(mois: number, year?: number): string {
  const s = new Intl.DateTimeFormat(appLocale(), { month: 'long' }).format(new Date(year ?? 2000, mois - 1, 1));
  return s.charAt(0).toLocaleUpperCase(appLocale()) + s.slice(1);
}

// Jours de semaine abrégés, lundi en premier (en-têtes de grille calendrier).
export function weekdayShortNames(): string[] {
  const fmt = new Intl.DateTimeFormat(appLocale(), { weekday: 'short' });
  // Le 5 janvier 2004 est un lundi.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2004, 0, 5 + i)));
}
