-- Ajoute les types de documents pour la convocation des parents et
-- la demande d'autorisation d'absence du personnel (équivalent personnel
-- de AUTORISATION_ABSENCE_ELEVE).

ALTER TYPE "TypeDocument" ADD VALUE IF NOT EXISTS 'AUTORISATION_ABSENCE_PERSONNEL';
ALTER TYPE "TypeDocument" ADD VALUE IF NOT EXISTS 'CONVOCATION_PARENT';
