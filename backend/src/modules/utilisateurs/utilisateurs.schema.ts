import { z } from 'zod';

export const utilisateurSchema = z.object({
  nom_fr: z.string().min(1),
  nom_ar: z.string().default(''),
  identifiant: z.string().min(1),
  mot_de_passe: z.string().min(6),
  email: z.string().email().optional(),
  role_id: z.string().optional(),
  langue: z.string().optional(),
  theme: z.string().optional(),
});

export const resetPasswordSchema = z.object({
  nouveau_mot_de_passe: z.string().min(6),
});

export type UtilisateurInput = z.infer<typeof utilisateurSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
