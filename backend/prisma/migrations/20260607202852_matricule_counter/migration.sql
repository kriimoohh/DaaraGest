-- CreateTable
CREATE TABLE "MatriculeCounter" (
    "etablissement_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "annee" TEXT NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MatriculeCounter_pkey" PRIMARY KEY ("etablissement_id","type","annee")
);

-- Reprise des compteurs depuis les matricules déjà attribués (élèves 'E',
-- personnel 'P'), pour qu'après bascule des séquences Postgres le prochain
-- matricule = max existant + 1 (aucune collision). Sur une base vierge, ces
-- INSERT ne sélectionnent rien (compteurs créés à la volée par l'application).
INSERT INTO "MatriculeCounter" ("etablissement_id", "type", "annee", "last_value")
SELECT "etablissement_id", 'E',
       substring("matricule" from '-E-([0-9]{2})-'),
       max(cast(substring("matricule" from '-E-[0-9]{2}-0*([0-9]+)$') AS INTEGER))
FROM "Eleve"
WHERE "matricule" ~ '-E-[0-9]{2}-[0-9]+$'
GROUP BY "etablissement_id", substring("matricule" from '-E-([0-9]{2})-')
ON CONFLICT ("etablissement_id", "type", "annee") DO UPDATE
  SET "last_value" = GREATEST("MatriculeCounter"."last_value", EXCLUDED."last_value");

INSERT INTO "MatriculeCounter" ("etablissement_id", "type", "annee", "last_value")
SELECT u."etablissement_id", 'P',
       substring(p."matricule" from '-P-([0-9]{2})-'),
       max(cast(substring(p."matricule" from '-P-[0-9]{2}-0*([0-9]+)$') AS INTEGER))
FROM "Personnel" p
JOIN "Utilisateur" u ON u."id" = p."utilisateur_id"
WHERE p."matricule" ~ '-P-[0-9]{2}-[0-9]+$'
GROUP BY u."etablissement_id", substring(p."matricule" from '-P-([0-9]{2})-')
ON CONFLICT ("etablissement_id", "type", "annee") DO UPDATE
  SET "last_value" = GREATEST("MatriculeCounter"."last_value", EXCLUDED."last_value");
