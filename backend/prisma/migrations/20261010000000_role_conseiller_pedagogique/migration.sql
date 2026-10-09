-- Nouveau rôle « conseiller pédagogique » (mêmes droits que le directeur, cf. config/roles.ts).
-- Le seed de production saute son exécution quand les rôles existent déjà : la ligne est donc
-- créée ici, de façon idempotente.
INSERT INTO "Role" ("id", "libelle_fr", "permissions")
VALUES ('role-conseiller-pedagogique', 'conseiller pédagogique', '{}')
ON CONFLICT ("libelle_fr") DO NOTHING;
