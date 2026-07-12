-- Combiné au choix : codes des filières fusionnées d'un bulletin COMBINE
-- (ex. "FR,AR"). null = repli sur les filières actives (comportement historique).
ALTER TABLE "Bulletin" ADD COLUMN "filieres_combine" TEXT;
