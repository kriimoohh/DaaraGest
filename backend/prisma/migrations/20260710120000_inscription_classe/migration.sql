-- Phase 2a refonte filières : jointure InscriptionClasse (une classe par filière
-- et par inscription), peuplée en parallèle des colonnes classe_fr_id/classe_ar_id.
-- Non destructif : les 2 colonnes restent la source de vérité (lecteurs inchangés).

CREATE TABLE "InscriptionClasse" (
    "id" TEXT NOT NULL,
    "inscription_id" TEXT NOT NULL,
    "filiere_id" TEXT NOT NULL,
    "classe_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InscriptionClasse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InscriptionClasse_inscription_id_filiere_id_key" ON "InscriptionClasse"("inscription_id", "filiere_id");
CREATE INDEX "InscriptionClasse_classe_id_idx" ON "InscriptionClasse"("classe_id");
CREATE INDEX "InscriptionClasse_filiere_id_idx" ON "InscriptionClasse"("filiere_id");
CREATE INDEX "InscriptionClasse_inscription_id_idx" ON "InscriptionClasse"("inscription_id");

-- Backfill : une ligne par classe assignée. On lit la filière directement depuis
-- la classe (Classe.filiere_id, renseigné en Phase 0), ce qui est robuste sans
-- avoir à résoudre FR/AR par code.
INSERT INTO "InscriptionClasse" ("id", "inscription_id", "filiere_id", "classe_id", "created_at")
SELECT gen_random_uuid(), i."id", c."filiere_id", c."id", CURRENT_TIMESTAMP
FROM "Inscription" i
JOIN "Classe" c ON c."id" = i."classe_fr_id"
WHERE c."filiere_id" IS NOT NULL
ON CONFLICT ("inscription_id", "filiere_id") DO NOTHING;

INSERT INTO "InscriptionClasse" ("id", "inscription_id", "filiere_id", "classe_id", "created_at")
SELECT gen_random_uuid(), i."id", c."filiere_id", c."id", CURRENT_TIMESTAMP
FROM "Inscription" i
JOIN "Classe" c ON c."id" = i."classe_ar_id"
WHERE c."filiere_id" IS NOT NULL
ON CONFLICT ("inscription_id", "filiere_id") DO NOTHING;

-- Clés étrangères (posées après backfill : les valeurs sont valides).
ALTER TABLE "InscriptionClasse" ADD CONSTRAINT "InscriptionClasse_inscription_id_fkey"
    FOREIGN KEY ("inscription_id") REFERENCES "Inscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InscriptionClasse" ADD CONSTRAINT "InscriptionClasse_filiere_id_fkey"
    FOREIGN KEY ("filiere_id") REFERENCES "Filiere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InscriptionClasse" ADD CONSTRAINT "InscriptionClasse_classe_id_fkey"
    FOREIGN KEY ("classe_id") REFERENCES "Classe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
