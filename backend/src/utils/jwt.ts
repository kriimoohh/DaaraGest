export interface JwtPayload {
  id: string;
  role: string;
  etablissement_id: string;
  langue: string;
  theme: string;
  doit_changer_mdp: boolean;
}
