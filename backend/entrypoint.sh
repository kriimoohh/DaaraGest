#!/bin/sh
set -e

echo "=== Prisma: baseline + deploy ==="

# On the very first deployment the DB was created with `prisma db push` and has
# no _prisma_migrations table.  We mark every migration file as already-applied
# so Prisma doesn't try to re-run DDL that already exists.
# On subsequent deployments the migrations are already recorded and the
# `migrate resolve` calls exit 0 silently (already-applied migrations are
# simply skipped), then `migrate deploy` applies any NEW migrations only.
for dir in prisma/migrations/*/; do
  [ -d "$dir" ] || continue
  name=$(basename "$dir")
  npx prisma migrate resolve --applied "$name" 2>/dev/null || true
done

npx prisma migrate deploy

echo "=== Seed ==="
node prisma/seed-prod.cjs

echo "=== Start ==="
exec node dist/server.js
