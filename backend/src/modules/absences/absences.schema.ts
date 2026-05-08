import { z } from 'zod';

const heureRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const absenceSchema = z.object({
  eleve_id: z.string().min(1),
  classe_id: z.string().min(1),
  annee_scolaire_id: z.string().min(1),
  date: z.string().regex(dateRegex, 'Format date invalide (YYYY-MM-DD)'),
  statut: z.enum(['present', 'absent', 'retard', 'dispense']),
  justifiee: z.boolean().optional().default(false),
  motif: z.string().max(500).optional(),
  heure_arrivee: z.string().regex(heureRegex, 'Format HH:MM attendu').optional(),
});

export const bulkAbsenceSchema = z.object({
  classe_id: z.string().min(1),
  annee_scolaire_id: z.string().min(1),
  date: z.string().regex(dateRegex),
  absences: z.array(absenceSchema.omit({ classe_id: true, annee_scolaire_id: true, date: true })).min(1),
});

export type AbsenceInput = z.infer<typeof absenceSchema>;
export type BulkAbsenceInput = z.infer<typeof bulkAbsenceSchema>;
