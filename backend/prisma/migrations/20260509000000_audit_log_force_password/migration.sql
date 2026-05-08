-- AlterTable: ajout du flag de changement de mot de passe forcé
ALTER TABLE "Utilisateur" ADD COLUMN "doit_changer_mdp" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: journal d'audit des actions sensibles
CREATE TABLE "AuditLog" (
    "id"               TEXT        NOT NULL,
    "etablissement_id" TEXT        NOT NULL,
    "utilisateur_id"   TEXT        NOT NULL,
    "action"           TEXT        NOT NULL,
    "entite"           TEXT        NOT NULL,
    "entite_id"        TEXT        NOT NULL,
    "details"          JSONB,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_etablissement_id_created_at_idx" ON "AuditLog"("etablissement_id", "created_at");
CREATE INDEX "AuditLog_entite_entite_id_idx" ON "AuditLog"("entite", "entite_id");
