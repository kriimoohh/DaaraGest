-- Séquence globale pour les numéros de reçu (garantit l'unicité sans collision)
CREATE SEQUENCE IF NOT EXISTS seq_recu_numero START 1 INCREMENT 1;
