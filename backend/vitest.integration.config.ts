import { defineConfig } from 'vitest/config';

// Config dédiée aux tests d'intégration : ils nécessitent une vraie base
// PostgreSQL (DATABASE_URL) avec les migrations appliquées. Lancés séparément
// des tests unitaires (`npm test`) pour garder ces derniers sans dépendance DB.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.itest.ts'],
    // Séquentiel : les tests partagent la même base et nettoient leurs données.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
