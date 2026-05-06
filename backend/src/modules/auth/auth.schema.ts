import { z } from 'zod';

export const loginSchema = z.object({
  identifiant: z.string().min(1, 'Identifiant requis'),
  mot_de_passe: z.string().min(1, 'Mot de passe requis'),
});

export type LoginInput = z.infer<typeof loginSchema>;
