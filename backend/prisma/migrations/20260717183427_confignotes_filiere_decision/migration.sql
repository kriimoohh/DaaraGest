-- Filière décisionnaire du passage (module Progression). Défaut COMBINE =
-- l'agrégat pondéré déjà calculé ; évite le double comptage FR+AR+COMBINE.
ALTER TABLE "ConfigNotes" ADD COLUMN "filiere_decision" TEXT NOT NULL DEFAULT 'COMBINE';
