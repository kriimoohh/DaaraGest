import { z } from 'zod';

export const TYPE_ABSENCE_VALUES = ['CONGE_ANNUEL', 'MALADIE', 'PERMISSION', 'AUTRE'] as const;
export type TypeAbsence = typeof TYPE_ABSENCE_VALUES[number];

export const TYPE_ABSENCE_LABELS: Record<TypeAbsence, string> = {
  CONGE_ANNUEL: 'Congé annuel',
  MALADIE:      'Maladie',
  PERMISSION:   'Permission',
  AUTRE:        'Autre',
};

export const STATUT_DEMANDE_VALUES = ['EN_ATTENTE', 'APPROUVE', 'REFUSE'] as const;
export type StatutDemande = typeof STATUT_DEMANDE_VALUES[number];

export const creerDemandeSchema = z.object({
  personnel_id: z.string().min(1),
  date_debut:    z.string().min(1),
  date_fin:      z.string().min(1),
  motif:         z.string().min(1).max(1000),
  type_absence:  z.enum(TYPE_ABSENCE_VALUES),
});

export const traiterDemandeSchema = z.object({
  statut:      z.enum(['APPROUVE', 'REFUSE']),
  commentaire: z.string().max(500).optional(),
});

export type CreerDemandeInput   = z.infer<typeof creerDemandeSchema>;
export type TraiterDemandeInput = z.infer<typeof traiterDemandeSchema>;
