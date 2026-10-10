#!/bin/sh
set -e

echo "=== Prisma: migrate deploy ==="
npx prisma migrate deploy

echo "=== Seed ==="
node prisma/seed-prod.cjs

echo "=== Start ==="
exec node dist/server.js
