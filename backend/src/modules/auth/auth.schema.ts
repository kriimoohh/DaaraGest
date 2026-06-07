import { z } from 'zod';

export const loginSchema = z.object({
  identifiant: z.string().min(1, 'Identifiant requis').max(50),
  mot_de_passe: z.string().min(1, 'Mot de passe requis'),
  // Identifiant d'appareil (UUID client) pour la rotation refresh par device.
  device_id: z.string().max(64).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
