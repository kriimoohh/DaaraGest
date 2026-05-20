export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordValidation {
  valide: boolean;
  raisons: string[];
}

export function validerForceMotDePasse(mdp: string): PasswordValidation {
  const raisons: string[] = [];
  if (mdp.length < PASSWORD_MIN_LENGTH) raisons.push(`Minimum ${PASSWORD_MIN_LENGTH} caractères`);
  if (!/[A-Z]/.test(mdp)) raisons.push('Au moins une majuscule');
  if (!/[a-z]/.test(mdp)) raisons.push('Au moins une minuscule');
  if (!/[0-9]/.test(mdp)) raisons.push('Au moins un chiffre');
  if (!/[^A-Za-z0-9]/.test(mdp)) raisons.push('Au moins un caractère spécial');
  return { valide: raisons.length === 0, raisons };
}

export function assertMotDePasseValide(mdp: string): void {
  const { valide, raisons } = validerForceMotDePasse(mdp);
  if (!valide) {
    throw new Error(`Mot de passe insuffisant : ${raisons.join(', ')}`);
  }
}
