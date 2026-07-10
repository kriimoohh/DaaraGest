import { z } from 'zod';

// Liste fermée des codes de filière supportés par la plateforme.
export const FILIERE_CODES = ['FR', 'AR', 'EN'] as const;
export type FiliereCode = typeof FILIERE_CODES[number];

// Défauts d'affichage appliqués à la création quand un champ n'est pas fourni.
export const FILIERE_DEFAULTS: Record<FiliereCode, {
  nom_fr: string; nom_ar: string | null; langue: string; sens_ecriture: 'LTR' | 'RTL'; couleur: string; ordre: number;
}> = {
  FR: { nom_fr: 'Filière française', nom_ar: null,             langue: 'fr', sens_ecriture: 'LTR', couleur: '#DDE2F1', ordre: 0 },
  AR: { nom_fr: 'Filière arabe',     nom_ar: 'الشعبة العربية',  langue: 'ar', sens_ecriture: 'RTL', couleur: '#DCEBDF', ordre: 1 },
  EN: { nom_fr: 'Filière anglaise',  nom_ar: null,             langue: 'en', sens_ecriture: 'LTR', couleur: '#F1E4DD', ordre: 2 },
};

export const filiereCreateSchema = z.object({
  code: z.enum(FILIERE_CODES),
  nom_fr: z.string().min(1).optional(),
  nom_ar: z.string().trim().optional().nullable(),
  langue: z.string().min(1).optional(),
  sens_ecriture: z.enum(['LTR', 'RTL']).optional(),
  note_max: z.number().positive().nullable().optional(),
  couleur: z.string().min(1).optional(),
  ordre: z.number().int().min(0).optional(),
  actif: z.boolean().optional(),
});

// Le code n'est pas modifiable (clé stable stockée sur classes/matières).
export const filiereUpdateSchema = z.object({
  nom_fr: z.string().min(1).optional(),
  nom_ar: z.string().trim().optional().nullable(),
  langue: z.string().min(1).optional(),
  sens_ecriture: z.enum(['LTR', 'RTL']).optional(),
  note_max: z.number().positive().nullable().optional(),
  couleur: z.string().min(1).optional(),
  ordre: z.number().int().min(0).optional(),
  actif: z.boolean().optional(),
});

export type FiliereCreateInput = z.infer<typeof filiereCreateSchema>;
export type FiliereUpdateInput = z.infer<typeof filiereUpdateSchema>;
