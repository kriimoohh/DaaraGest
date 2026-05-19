import { z } from 'zod';

export const utilisateurSchema = z.object({
  nom_fr: z.string().min(1),
  prenom_fr: z.string().optional(),
  identifiant: z.string().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/, "Caractères autorisés : lettres, chiffres, . _ -"),
  mot_de_passe: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  email: z.string().email().optional(),
  role_id: z.string().optional(),
  langue: z.string().optional(),
  theme: z.string().optional(),
});

export const resetPasswordSchema = z.object({
  nouveau_mot_de_passe: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
});

export type UtilisateurInput = z.infer<typeof utilisateurSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
