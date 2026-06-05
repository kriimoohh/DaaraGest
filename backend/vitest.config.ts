import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Les tests d'intégration (*.itest.ts) ont leur propre config et requièrent
    // une vraie base — on les écarte de la suite unitaire (sans DB).
    exclude: ['**/node_modules/**', '**/*.itest.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'html'], include: ['src/**/*.ts'], exclude: ['src/server.ts'] },
  },
});
