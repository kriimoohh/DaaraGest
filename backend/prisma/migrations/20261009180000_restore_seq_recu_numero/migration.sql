-- La séquence des numéros de reçu (créée par 20260510000000_add_sequence_recu) a été
-- perdue lors du squash de l'historique en baseline : en prod, nextval('seq_recu_numero')
-- échouait et TOUT paiement élève (création unitaire ou en masse) retournait une 500.
-- IF NOT EXISTS : sans effet là où elle existe déjà (bases qui ont l'ancien historique).
CREATE SEQUENCE IF NOT EXISTS seq_recu_numero START 1 INCREMENT 1;
