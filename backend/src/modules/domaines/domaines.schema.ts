import { z } from 'zod';

// Codes des domaines pédagogiques sénégalais (référentiel LGM).
// 'AUTRE' couvre les matières hors-grille (ex : matières religieuses optionnelles).
export const DOMAINE_CODES = [
  'LANGUE_COMMUNICATION',
  'MATHEMATIQUES',
  'ESVS',
  'EPSA',
  'RELIGION',
  'EVEIL',
  'AUTRE',
] as const;

export const creerDomaineSchema = z.object({
  nom_fr: z.string().trim().min(1).max(80),
  code:   z.enum(DOMAINE_CODES),
  ordre:  z.number().int().min(0).optional(),
  actif:  z.boolean().optional(),
});

export const modifierDomaineSchema = z.object({
  nom_fr: z.string().trim().min(1).max(80).optional(),
  code:   z.enum(DOMAINE_CODES).optional(),
  ordre:  z.number().int().min(0).optional(),
  actif:  z.boolean().optional(),
});

export type CreerDomaineInput    = z.infer<typeof creerDomaineSchema>;
export type ModifierDomaineInput = z.infer<typeof modifierDomaineSchema>;
