import { z } from 'zod';
import {
  chainHashOf,
  parseRelays,
} from '../modules/raffles/infrastructure/drand/drand-http-beacon';
import { parseTrustProxy } from '../common/http/client-ip';

const emptyAsUnset = (value: unknown) => (value === '' ? undefined : value);

/** Only tests may run without their own secret. */
const TEST_JWT_SECRET = 'test-only-jwt-secret-for-rifas-min-32-chars';

export const envSchema = z.object({
  // Required: nothing may silently fall back to a development mode.
  NODE_ENV: z.enum(['development', 'production', 'test']),
  // Express `trust proxy`: req.ip comes from X-Forwarded-For only for these
  // peers. A hop count or a list of addresses or CIDR ranges; never `true`.
  TRUST_PROXY: z.string().default('loopback'),
  // Comma-separated origins the browser may call from. Production: explicit.
  CORS_ORIGINS: z.string().default('http://localhost:4200'),
  // Development only, and only when asked: log access links and email ids
  // instead of sending anything.
  EMAIL_LOG_ONLY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('api'),

  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/rifas?schema=public'),
  // 55380: this project's own Redis (docker compose). Port 6379 belongs to
  // another project on the development machine.
  REDIS_URL: z.string().default('redis://localhost:55380'),
  // Each dependency check of GET /health/ready gives up after this long.
  HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().int().positive().default(2_000),

  // Jobs (F5, guide §6.4). Off for the HTTP-only e2e tests.
  JOBS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  DRAW_DELAY_SECONDS: z.coerce.number().nonnegative().default(5),
  DRAW_RETRY_INTERVAL_SECONDS: z.coerce.number().positive().default(5),
  // Long: the draw always waits for the same round, so a short incident
  // must not use up its attempts. After it, the reconcile adds it again.
  DRAW_RETRY_WINDOW_MINUTES: z.coerce.number().positive().default(60),
  // How long a failed close or draw waits before the reconcile adds it again.
  JOB_RECOVERY_COOLDOWN_MINUTES: z.coerce.number().positive().default(5),

  DRAND_CHAIN_HASH: z.string().default('52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971'),
  DRAND_RELAYS: z.string().default('https://api.drand.sh,https://api2.drand.sh,https://drand.cloudflare.com'),
  // quicknet (DT-01). From configuration, never from a relay.
  DRAND_PUBLIC_KEY: z
    .string()
    .regex(/^[0-9a-f]{192}$/)
    .default(
      '83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a',
    ),
  DRAND_GENESIS_TIME: z.coerce.number().int().positive().default(1692803367),
  // With the key, period and genesis, these must hash to DRAND_CHAIN_HASH:
  // checked at startup, without network.
  DRAND_GROUP_HASH: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .default('f477d5c89f21a17c863a7f937c6a6d15859414d2be09cd448d4279af331c5d3e'),
  DRAND_BEACON_ID: z.string().min(1).default('quicknet'),
  DRAND_PERIOD_SECONDS: z.coerce.number().int().positive().default(3),
  DRAND_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),

  SEED_ENCRYPTION_KEY_REF: z.string().optional(),
  // Development and test only: base64 of 32 bytes. Production must use the
  // secrets manager, which is not built yet.
  SEED_ENCRYPTION_KEY: z.string().optional(),

  // D5: tiendi-notifications, email channel. Required in production.
  // An empty value means unset: tests clear them that way, as Prisma loads
  // the env file into process.env without overriding what is already there.
  NOTIFICATIONS_URL: z.preprocess(emptyAsUnset, z.string().url().optional()),
  NOTIFICATIONS_SERVICE_TOKEN: z.preprocess(emptyAsUnset, z.string().min(1).optional()),
  NOTIFICATIONS_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  // Who receives the operator emails (overdue verifications), comma separated.
  OPERATOR_ALERT_EMAILS: z.string().default(''),

  // D4: one-time access links and the sessions they open.
  MAGIC_LINK_BASE_URL: z.string().url().default('http://localhost:4200/acceso'),
  MAGIC_LINK_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  MAGIC_LINK_MAX_PER_WINDOW: z.coerce.number().int().positive().default(3),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(720),
  // Google Sign-In audience; leave unset to disable Google login.
  GOOGLE_CLIENT_ID: z.preprocess(emptyAsUnset, z.string().min(1).optional()),

  // Per client IP (guide §6.5, point 3).
  RATE_LIMIT_RESERVATION_PER_MINUTE: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_PROOF_PER_MINUTE: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_MAGIC_LINK_PER_15_MINUTES: z.coerce.number().int().positive().default(5),
  // Password login, registration, Google sign-in and password setup, per client IP.
  RATE_LIMIT_AUTH_PER_MINUTE: z.coerce.number().int().positive().default(10),

  RESERVATION_TTL_MINUTES: z.coerce.number().positive().default(15),
  PROOF_VERIFICATION_TTL_HOURS: z.coerce.number().positive().default(12),
  PROOF_DEADLINE_MINUTES_BEFORE_CLOSE: z.coerce.number().nonnegative().default(120),
  PROOF_MAX_FILE_BYTES: z.coerce.number().positive().default(5 * 1024 * 1024),
  PROOF_STORAGE_DIR: z.string().min(1).default('./storage/proofs'),
  MAX_TICKETS_PER_RESERVATION: z.coerce.number().positive().default(20),
  MAX_ACTIVE_RESERVED_PER_BUYER: z.coerce.number().positive().default(20),

  // Email outbox (DT-13): retries with exponential backoff for about 28.6 h,
  // then an operator alert.
  NOTIFICATION_MAX_ATTEMPTS: z.coerce.number().int().positive().default(11),
  NOTIFICATION_RETRY_BASE_SECONDS: z.coerce.number().nonnegative().default(300),
  NOTIFICATION_RETRY_MAX_SECONDS: z.coerce.number().nonnegative().default(21_600),
  NOTIFICATION_LEASE_SECONDS: z.coerce.number().positive().default(300),
  NOTIFICATION_SEND_TIMEOUT_SECONDS: z.coerce.number().positive().default(30),
  NOTIFICATION_BATCH_SIZE: z.coerce.number().int().positive().default(50),
  NOTIFICATION_RETENTION_DAYS: z.coerce.number().int().positive().default(30),

  // No default outside tests: a public secret would let anyone sign sessions.
  JWT_SECRET: z.string().min(32).optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/** Rules across several variables. */
const checkedEnvSchema = envSchema
  .refine(
    (env) =>
      env.NOTIFICATION_LEASE_SECONDS > env.NOTIFICATION_SEND_TIMEOUT_SECONDS,
    {
      message:
        'NOTIFICATION_LEASE_SECONDS must be longer than NOTIFICATION_SEND_TIMEOUT_SECONDS, or a slow email goes out twice',
      path: ['NOTIFICATION_LEASE_SECONDS'],
    },
  )
  .refine(
    (env) => {
      try {
        return parseRelays(env.DRAND_RELAYS.split(',')).length > 0;
      } catch {
        return false;
      }
    },
    {
      message: 'DRAND_RELAYS must list at least one https URL',
      path: ['DRAND_RELAYS'],
    },
  )
  .refine(
    // Checked here, before any module opens a connection, and only when the
    // jobs run: they are the only users of drand.
    (env) =>
      !env.JOBS_ENABLED ||
      chainHashOf({
        chainHash: env.DRAND_CHAIN_HASH,
        publicKeyHex: env.DRAND_PUBLIC_KEY,
        periodSec: env.DRAND_PERIOD_SECONDS,
        genesisTimeSec: env.DRAND_GENESIS_TIME,
        groupHashHex: env.DRAND_GROUP_HASH,
        beaconId: env.DRAND_BEACON_ID,
      }) === env.DRAND_CHAIN_HASH,
    {
      message:
        'DRAND_CHAIN_HASH does not match DRAND_PUBLIC_KEY, DRAND_PERIOD_SECONDS, DRAND_GENESIS_TIME, DRAND_GROUP_HASH and DRAND_BEACON_ID',
      path: ['DRAND_CHAIN_HASH'],
    },
  )
  .refine((env) => env.NODE_ENV === 'test' || Boolean(env.JWT_SECRET), {
    message: 'JWT_SECRET is required: only tests run without their own secret',
    path: ['JWT_SECRET'],
  })
  .refine(
    (env) => {
      try {
        parseTrustProxy(env.TRUST_PROXY);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'TRUST_PROXY must be a hop count or a list of trusted proxies, never every peer', path: ['TRUST_PROXY'] },
  )
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' ||
      (Boolean(env.CORS_ORIGINS.trim()) &&
        !env.CORS_ORIGINS.split(',').some((origin) => origin.trim() === '*')),
    { message: 'CORS_ORIGINS must list the allowed origins in production, never *', path: ['CORS_ORIGINS'] },
  )
  .refine((env) => !env.EMAIL_LOG_ONLY || env.NODE_ENV === 'development', {
    message: 'EMAIL_LOG_ONLY is for development only',
    path: ['EMAIL_LOG_ONLY'],
  })
  .refine(
    (env) =>
      env.NODE_ENV === 'test' ||
      env.EMAIL_LOG_ONLY ||
      (Boolean(env.NOTIFICATIONS_URL) && Boolean(env.NOTIFICATIONS_SERVICE_TOKEN)),
    {
      message:
        'NOTIFICATIONS_URL and NOTIFICATIONS_SERVICE_TOKEN are required: without them no access link or email leaves. In development, EMAIL_LOG_ONLY=true logs them instead',
      path: ['NOTIFICATIONS_URL'],
    },
  )
  .refine(
    (env) =>
      env.NODE_ENV !== 'production' ||
      (!env.MAGIC_LINK_BASE_URL.startsWith('http://localhost') &&
        new URL(env.MAGIC_LINK_BASE_URL).protocol === 'https:'),
    {
      // Its origin also builds the verification link of the payment email (DT-20).
      message: 'MAGIC_LINK_BASE_URL must point at the public web page, over https, in production',
      path: ['MAGIC_LINK_BASE_URL'],
    },
  )
  .refine(
    (env) => env.NODE_ENV !== 'production' || !env.SEED_ENCRYPTION_KEY,
    {
      message:
        'SEED_ENCRYPTION_KEY is for development and test only: production uses the secrets manager',
      path: ['SEED_ENCRYPTION_KEY'],
    },
  );

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const parsed = checkedEnvSchema.safeParse(config);
  if (!parsed.success) {
    const errors = parsed.error.format();
    throw new Error(`Environment validation failed: ${JSON.stringify(errors, null, 2)}`);
  }
  // Reached without a secret only under tests (see the refine above).
  return { ...parsed.data, JWT_SECRET: parsed.data.JWT_SECRET ?? TEST_JWT_SECRET };
}
