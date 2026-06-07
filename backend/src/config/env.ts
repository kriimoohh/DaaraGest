import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est requis'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET doit faire au moins 32 caractères'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  QR_SECRET: z.string().min(32, 'QR_SECRET doit faire au moins 32 caractères'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_DOMAIN: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
  // Observabilité (optionnel) : si SENTRY_DSN absent, Sentry est désactivé (no-op).
  SENTRY_DSN: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const erreurs = parsed.error.errors.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
    console.error(`[ERREUR] Variables d'environnement invalides :\n${erreurs}`);
    process.exit(1);
  }
  return parsed.data;
}

// Le test runner Vitest peut charger les services sans toutes les variables.
// On laisse `env` vide dans ce cas — chaque accès retombe sur process.env.
const isTestRun = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

export const env: Env = isTestRun
  ? ({
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      JWT_SECRET: process.env.JWT_SECRET ?? 'test-secret-min-32-chars-padding-string',
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '24h',
      QR_SECRET: process.env.QR_SECRET ?? 'test-qr-secret-min-32-chars-padding-x',
      CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
      COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
      NODE_ENV: 'test',
      PORT: 3000,
      PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH,
      SENTRY_DSN: undefined,
      SENTRY_TRACES_SAMPLE_RATE: 0,
    } as Env)
  : loadEnv();

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
