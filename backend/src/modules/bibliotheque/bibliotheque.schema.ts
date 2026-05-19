import { z } from 'zod';

export const livreSchema = z.object({
  isbn:            z.string().max(20).optional(),
  titre:           z.string().min(1).max(200),
  auteur:          z.string().max(150).optional(),
  editeur:         z.string().max(150).optional(),
  annee_edition:   z.number().int().min(1800).max(2100).optional(),
  categorie:       z.string().max(80).optional(),
  quantite_totale: z.number().int().min(1).default(1),
});

export const updateLivreSchema = livreSchema.partial().extend({ actif: z.boolean().optional() });

export const empruntSchema = z.object({
  livre_id:           z.string().min(1),
  eleve_id:           z.string().min(1),
  date_retour_prevue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const retourSchema = z.object({
  statut: z.enum(['rendu', 'perdu']).default('rendu'),
});

export type LivreInput        = z.infer<typeof livreSchema>;
export type UpdateLivreInput  = z.infer<typeof updateLivreSchema>;
export type EmpruntInput      = z.infer<typeof empruntSchema>;
export type RetourInput       = z.infer<typeof retourSchema>;
