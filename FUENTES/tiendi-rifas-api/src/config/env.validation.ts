import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('api'),

  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/rifas?schema=public'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  CULQI_SECRET_KEY: z.string().optional(),
  CULQI_PUBLIC_KEY: z.string().optional(),
  CULQI_WEBHOOK_SECRET: z.string().min(10).optional(),

  DRAND_CHAIN_HASH: z.string().default('52db929800de6b1d61994484021644b370a7feb8365a9b7d536eb243802c2da8'),
  DRAND_RELAYS: z.string().default('https://api.drand.sh,https://api2.drand.sh,https://drand.cloudflare.com'),

  SEED_ENCRYPTION_KEY_REF: z.string().optional(),

  NOTIFICATIONS_URL: z.string().url().optional(),
  NOTIFICATIONS_SERVICE_TOKEN: z.string().optional(),

  RESERVATION_TTL_MINUTES: z.coerce.number().positive().default(10),
  MAX_TICKETS_PER_RESERVATION: z.coerce.number().positive().default(20),
  MAX_ACTIVE_RESERVED_PER_BUYER: z.coerce.number().positive().default(20),

  JWT_SECRET: z.string().min(16).default('local-jwt-secret-for-rifas-min-32-chars-long'),
  JWT_EXPIRES_IN: z.string().default('7d'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const errors = parsed.error.format();
    throw new Error(`Environment validation failed: ${JSON.stringify(errors, null, 2)}`);
  }
  return parsed.data;
}
