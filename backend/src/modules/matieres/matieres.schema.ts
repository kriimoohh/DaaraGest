import { z } from 'zod';

// type_note : 'SIMPLE' pour la majorité des matières. 'RESSOURCE' / 'COMPETENCE'
// servent aux grilles IEF CE1-CE2 / CM1-CM2 où une matière alimente l'une
// des deux colonnes de son domaine.
export const TYPE_NOTE = ['SIMPLE', 'RESSOURCE', 'COMPETENCE'] as const;

export const matiereSchema = z.object({
  nom_fr: z.string().min(1),
  nom_ar: z.string().optional(),
  filiere: z.enum(['FR', 'AR']),
  coeff_defaut: z.number().positive().optional(),
  note_min: z.number().min(0).optional(),
  ordre_bulletin: z.number().int().optional(),
  domaine_id: z.string().uuid().nullable().optional(),
  type_note: z.enum(TYPE_NOTE).optional(),
  code_court: z.string().trim().max(16).nullable().optional(),
});

export type MatiereInput = z.infer<typeof matiereSchema>;
