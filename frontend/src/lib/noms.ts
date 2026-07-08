import i18n from '../i18n';

// Nom affiché d'une entité bilingue selon la langue courante : l'arabe si la langue
// est l'arabe ET qu'un nom arabe est renseigné, sinon le français (repli).
// Les composants appelants utilisent useTranslation → ils re-rendent au changement
// de langue, donc `i18n.language` est relu correctement.
type Bilingue = { nom_fr: string; nom_ar?: string | null };

export function nomBilingue(e: Bilingue): string {
  return i18n.language?.startsWith('ar') && e.nom_ar ? e.nom_ar : e.nom_fr;
}

// Alias explicites (lisibilité aux points d'appel).
export const nomMatiere = nomBilingue;
export const nomClasse = nomBilingue;
