import { z } from 'zod';

export const rapportPresencesElevesSchema = z.object({
  classe_id:        z.string().min(1).optional(),
  annee_scolaire_id: z.string().min(1).optional(),
  mois:             z.coerce.number().int().min(1).max(12).optional(),
  annee:            z.coerce.number().int().min(2020).optional(),
  format:           z.enum(['csv', 'pdf']).default('pdf'),
});

export const rapportPresencesProfesseursSchema = z.object({
  mois:   z.coerce.number().int().min(1).max(12).optional(),
  annee:  z.coerce.number().int().min(2020).optional(),
  format: z.enum(['csv', 'pdf']).default('pdf'),
});

export const rapportResultatsClasseSchema = z.object({
  classe_id:         z.string().min(1),
  annee_scolaire_id: z.string().min(1),
  periode:           z.coerce.number().int().min(0).max(3).optional(),
  format:            z.enum(['csv', 'pdf']).default('pdf'),
});

export const rapportBilanFinancierSchema = z.object({
  mois:   z.coerce.number().int().min(1).max(12).optional(),
  annee:  z.coerce.number().int().min(2020).optional(),
  format: z.enum(['csv', 'pdf']).default('pdf'),
});
