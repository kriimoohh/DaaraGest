-- Suppression du champ coefficient de ProfMatiereClasse
-- Ce champ était stocké mais jamais utilisé dans les calculs de bulletins.
-- Les coefficients des matières sont définis dans Matiere.coeff_defaut.
ALTER TABLE "ProfMatiereClasse" DROP COLUMN IF EXISTS "coefficient";
