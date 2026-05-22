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

// ─── Nouveaux schémas (grilles pédagogiques) ─────────────────────────────────

const baseClasseSchema = z.object({
  classe_id:         z.string().min(1),
  annee_scolaire_id: z.string().min(1),
  periode:           z.coerce.number().int().min(1).max(3).optional(),
});

export const rapportGrilleIefSchema         = baseClasseSchema;
export const rapportGrillePerformanceSchema = baseClasseSchema;
export const rapportPerformanceDomaineSchema = baseClasseSchema;
export const rapportReleveNotesSchema        = baseClasseSchema;

export const rapportPropositionsFinSchema = z.object({
  classe_id:         z.string().min(1),
  annee_scolaire_id: z.string().min(1),
});

// ─── Aperçus (mêmes filtres, sans format) ────────────────────────────────────

export const apercuPresencesElevesSchema       = rapportPresencesElevesSchema.omit({ format: true });
export const apercuPresencesProfesseursSchema  = rapportPresencesProfesseursSchema.omit({ format: true });
export const apercuResultatsClasseSchema       = rapportResultatsClasseSchema.omit({ format: true });
export const apercuBilanFinancierSchema        = rapportBilanFinancierSchema.omit({ format: true });
export const apercuGrilleIefSchema             = rapportGrilleIefSchema;
export const apercuGrillePerformanceSchema     = rapportGrillePerformanceSchema;
export const apercuPerformanceDomaineSchema    = rapportPerformanceDomaineSchema;
export const apercuReleveNotesSchema           = rapportReleveNotesSchema;
export const apercuPropositionsFinSchema       = rapportPropositionsFinSchema;
