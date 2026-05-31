import { z } from 'zod';

export const classeSchema = z.object({
  nom_fr: z.string().min(1),
  filiere: z.enum(['FR', 'AR']),
  niveau_id: z.string().optional().nullable(),
  annee_scolaire_id: z.string().uuid(),
  capacite: z.number().int().positive().optional(),
});

export const classeMatiereSchema = z.object({
  matiere_id: z.string().uuid(),
  coeff_override: z.number().positive().optional(),
  ordre_override: z.number().int().min(0).optional(),
});

export const classeMatiereUpdateSchema = z.object({
  coeff_override: z.number().positive().nullable().optional(),
  ordre_override: z.number().int().min(0).nullable().optional(),
});

export const dupliquerArSchema = z.object({
  nom_fr: z.string().min(1).optional(),
});

export type ClasseInput = z.infer<typeof classeSchema>;
export type ClasseMatiereInput = z.infer<typeof classeMatiereSchema>;
export type ClasseMatiereUpdateInput = z.infer<typeof classeMatiereUpdateSchema>;
export type DupliquerArInput = z.infer<typeof dupliquerArSchema>;
