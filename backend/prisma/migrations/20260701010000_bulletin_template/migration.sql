-- CreateTable
CREATE TABLE "BulletinTemplate" (
    "id" TEXT NOT NULL,
    "etablissement_id" TEXT NOT NULL,
    "contenu_html" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulletinTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BulletinTemplate_etablissement_id_key" ON "BulletinTemplate"("etablissement_id");

-- AddForeignKey
ALTER TABLE "BulletinTemplate" ADD CONSTRAINT "BulletinTemplate_etablissement_id_fkey" FOREIGN KEY ("etablissement_id") REFERENCES "Etablissement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
