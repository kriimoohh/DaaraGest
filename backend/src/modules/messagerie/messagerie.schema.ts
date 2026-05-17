import { z } from 'zod';

export const creerConversationSchema = z.object({
  sujet: z.string().min(1).max(200),
  corps: z.string().min(1).max(5000),
  // For individual: destinataire_ids list
  // For broadcast: cibles_roles list
  destinataire_ids: z.array(z.string().min(1)).optional(),
  cibles_roles: z.array(z.string().min(1)).optional(),
}).refine(d => (d.destinataire_ids && d.destinataire_ids.length > 0) || (d.cibles_roles && d.cibles_roles.length > 0), {
  message: 'Au moins un destinataire ou un rôle cible requis',
});

export const ajouterMessageSchema = z.object({
  corps: z.string().min(1).max(5000),
});

export type CreerConversationInput = z.infer<typeof creerConversationSchema>;
export type AjouterMessageInput = z.infer<typeof ajouterMessageSchema>;
