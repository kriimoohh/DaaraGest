// Formatage homogène du libellé d'une classe.
//
// Les noms de classe se répètent chaque année (« CE1 A » existe en 2024-2025 ET
// 2025-2026). Dans un contexte scopé à une année, le nom seul suffit ; dans un
// contexte INTER-ANNÉES (historique d'un élève, recherche globale, rapports), on
// ajoute l'année pour lever l'ambiguïté.

interface ClasseLike {
  nom_fr: string;
  filiere?: string;
  code?: string | null;
  annee_scolaire?: { libelle: string } | null;
}

interface FormatOpts {
  /** Ajoute la filière : « CE1 A · FR ». */
  filiere?: boolean;
  /** Ajoute l'année : « CE1 A · 2024-2025 ». À activer en contexte inter-années. */
  annee?: boolean;
}

/** Libellé lisible d'une classe, ex. « CE1 A · FR · 2024-2025 ». */
export function formatClasse(c: ClasseLike | null | undefined, opts: FormatOpts = {}): string {
  if (!c) return '—';
  const parts = [c.nom_fr];
  if (opts.filiere && c.filiere) parts.push(c.filiere);
  if (opts.annee && c.annee_scolaire?.libelle) parts.push(c.annee_scolaire.libelle);
  return parts.join(' · ');
}
