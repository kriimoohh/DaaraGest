import prisma from '../config/database';

// Défauts d'affichage par code de filière connu. Pour un code inconnu, on retombe
// sur un libellé neutre (le code lui-même) que l'admin pourra renommer en Phase 1.
const FILIERE_DEFAULTS: Record<string, {
  nom_fr: string; nom_ar: string | null; langue: string; sens_ecriture: string; couleur: string; ordre: number;
}> = {
  FR: { nom_fr: 'Filière française', nom_ar: null,            langue: 'fr', sens_ecriture: 'LTR', couleur: '#DDE2F1', ordre: 0 },
  AR: { nom_fr: 'Filière arabe',     nom_ar: 'الشعبة العربية', langue: 'ar', sens_ecriture: 'RTL', couleur: '#DCEBDF', ordre: 1 },
  EN: { nom_fr: 'Filière anglaise',  nom_ar: null,            langue: 'en', sens_ecriture: 'LTR', couleur: '#F1E4DD', ordre: 2 },
};

/**
 * Résout (et crée si besoin) la Filiere correspondant à un code pour un établissement,
 * puis renvoie son id. Utilisé en double-écriture (Phase 0 refonte filières) : chaque
 * classe/matière créée ou modifiée renseigne son `filiere_id` en plus de la chaîne
 * `filiere`, pour qu'aucune ligne n'ait un filiere_id null après la bascule. L'upsert
 * est idempotent et sûr en concurrence (unicité (etablissement_id, code)).
 */
export async function resolveFiliereId(etablissement_id: string, code: string): Promise<string> {
  const d = FILIERE_DEFAULTS[code] ?? {
    nom_fr: code, nom_ar: null, langue: 'fr', sens_ecriture: 'LTR', couleur: '#E5E7EB', ordre: 9,
  };
  const filiere = await prisma.filiere.upsert({
    where: { etablissement_id_code: { etablissement_id, code } },
    update: {},
    create: {
      etablissement_id,
      code,
      nom_fr: d.nom_fr,
      nom_ar: d.nom_ar,
      langue: d.langue,
      sens_ecriture: d.sens_ecriture,
      couleur: d.couleur,
      ordre: d.ordre,
    },
    select: { id: true },
  });
  return filiere.id;
}
