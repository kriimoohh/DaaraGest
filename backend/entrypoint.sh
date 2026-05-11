#!/bin/sh
set -e

echo "=== Prisma: baseline + deploy ==="

# Premier déploiement uniquement : la DB a été créée avec `prisma db push` et
# n'a pas encore de table _prisma_migrations. On marque toutes les migrations
# existantes comme déjà appliquées sans rejouer leur SQL.
# Les déploiements suivants sautent ce bloc et `migrate deploy` applique
# uniquement les nouvelles migrations normalement.
MIGRATIONS_EXIST=$(npx prisma db execute --stdin 2>/dev/null <<'SQL'
SELECT COUNT(*)::text FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = '_prisma_migrations';
SQL
)

if [ "$MIGRATIONS_EXIST" = "0" ]; then
  echo "Premier déploiement — baseline des migrations existantes"
  for dir in prisma/migrations/*/; do
    [ -d "$dir" ] || continue
    name=$(basename "$dir")
    npx prisma migrate resolve --applied "$name" 2>/dev/null || true
  done
fi

npx prisma migrate deploy

echo "=== Seed ==="
node prisma/seed-prod.cjs

echo "=== Start ==="
exec node dist/server.js
