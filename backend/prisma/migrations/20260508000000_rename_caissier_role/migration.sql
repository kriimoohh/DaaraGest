-- Renommer le rôle 'caissier' en 'agent de scolarité'
UPDATE "Role"
SET "libelle_fr" = 'agent de scolarité',
    "libelle_ar" = 'عون التمدرس'
WHERE "id" = 'role-caissier';
