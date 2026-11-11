import { envSchema, validateEnv } from './env.validation';

// NODE_ENV has no default: every case states it.
const v = (env: Record<string, unknown> = {}) => validateEnv({ NODE_ENV: 'test', ...env });

describe('validateEnv', () => {
  it('defaults the manual payment rules', () => {
    const env = v({});

    expect(env.RESERVATION_TTL_MINUTES).toBe(15);
    expect(env.PROOF_VERIFICATION_TTL_HOURS).toBe(12);
    expect(env.PROOF_DEADLINE_MINUTES_BEFORE_CLOSE).toBe(120);
    expect(env.PROOF_MAX_FILE_BYTES).toBe(5 * 1024 * 1024);
    expect(env.PROOF_STORAGE_DIR).toBe('./storage/proofs');
  });

  it('accepts configured values', () => {
    const env = v({
      RESERVATION_TTL_MINUTES: '20',
      PROOF_VERIFICATION_TTL_HOURS: '6',
      PROOF_DEADLINE_MINUTES_BEFORE_CLOSE: '60',
    });

    expect(env.RESERVATION_TTL_MINUTES).toBe(20);
    expect(env.PROOF_VERIFICATION_TTL_HOURS).toBe(6);
    expect(env.PROOF_DEADLINE_MINUTES_BEFORE_CLOSE).toBe(60);
  });

  it('allows a zero margin before the close, but no negative one', () => {
    expect(
      v({ PROOF_DEADLINE_MINUTES_BEFORE_CLOSE: '0' })
        .PROOF_DEADLINE_MINUTES_BEFORE_CLOSE,
    ).toBe(0);
    expect(() =>
      v({ PROOF_DEADLINE_MINUTES_BEFORE_CLOSE: '-1' }),
    ).toThrow('Environment validation failed');
  });

  it('defaults the email outbox to more than a day of retries (DT-13)', () => {
    const env = v({});

    expect(env.NOTIFICATION_MAX_ATTEMPTS).toBe(11);
    expect(env.NOTIFICATION_RETRY_BASE_SECONDS).toBe(300);
    expect(env.NOTIFICATION_RETRY_MAX_SECONDS).toBe(21_600);
    expect(env.NOTIFICATION_LEASE_SECONDS).toBe(300);
    expect(env.NOTIFICATION_SEND_TIMEOUT_SECONDS).toBe(30);
    expect(env.NOTIFICATION_BATCH_SIZE).toBe(50);
    expect(env.NOTIFICATION_RETENTION_DAYS).toBe(30);
  });

  it('refuses at startup a lease a send could outlast', () => {
    expect(() =>
      v({
        NOTIFICATION_LEASE_SECONDS: '30',
        NOTIFICATION_SEND_TIMEOUT_SECONDS: '30',
      }),
    ).toThrow('NOTIFICATION_LEASE_SECONDS');
    expect(
      v({
        NOTIFICATION_LEASE_SECONDS: '31',
        NOTIFICATION_SEND_TIMEOUT_SECONDS: '30',
      }).NOTIFICATION_LEASE_SECONDS,
    ).toBe(31);
  });

  it('refuses a retention under one day', () => {
    expect(() => v({ NOTIFICATION_RETENTION_DAYS: '0' })).toThrow(
      'Environment validation failed',
    );
  });

  it('refuses outbox settings that would never send', () => {
    expect(() => v({ NOTIFICATION_MAX_ATTEMPTS: '0' })).toThrow(
      'Environment validation failed',
    );
    expect(() => v({ NOTIFICATION_BATCH_SIZE: '1.5' })).toThrow(
      'Environment validation failed',
    );
    expect(() => v({ NOTIFICATION_LEASE_SECONDS: '0' })).toThrow(
      'Environment validation failed',
    );
  });

  it('defaults the jobs to the schedule of §6.4 (F5)', () => {
    const env = v({});

    expect(env.JOBS_ENABLED).toBe(true);
    expect(env.DRAW_DELAY_SECONDS).toBe(5);
    expect(env.DRAW_RETRY_INTERVAL_SECONDS).toBe(5);
    expect(env.DRAW_RETRY_WINDOW_MINUTES).toBe(60);
    expect(env.JOB_RECOVERY_COOLDOWN_MINUTES).toBe(5);
    expect(env.DRAND_BEACON_ID).toBe('quicknet');
    expect(env.DRAND_GROUP_HASH).toBe(
      'f477d5c89f21a17c863a7f937c6a6d15859414d2be09cd448d4279af331c5d3e',
    );
    expect(env.DRAND_GENESIS_TIME).toBe(1692803367);
    expect(env.DRAND_PERIOD_SECONDS).toBe(3);
    expect(env.DRAND_PUBLIC_KEY).toMatch(/^83cf0f28/);
  });

  it('reads JOBS_ENABLED=false as off, not as a truthy string', () => {
    expect(v({ JOBS_ENABLED: 'false' }).JOBS_ENABLED).toBe(false);
    expect(() => v({ JOBS_ENABLED: 'no' })).toThrow(
      'Environment validation failed',
    );
  });

  it('points Redis at this project, never at port 6379 (55380, outside the Windows reserved ranges)', () => {
    expect(v({}).REDIS_URL).toBe('redis://localhost:55380');
  });

  it('bounds each readiness check to 2 s by default', () => {
    expect(v({}).HEALTH_CHECK_TIMEOUT_MS).toBe(2_000);
    expect(v({ HEALTH_CHECK_TIMEOUT_MS: '500' }).HEALTH_CHECK_TIMEOUT_MS).toBe(500);
    expect(() => v({ HEALTH_CHECK_TIMEOUT_MS: '0' })).toThrow(
      'Environment validation failed',
    );
  });

  it('has no fallback round to configure (DT-18)', () => {
    expect(Object.keys(envSchema.shape)).not.toContain(
      'DRAW_FALLBACK_AFTER_MINUTES',
    );
  });

  it('needs https drand relays, at least one', () => {
    expect(() => v({ DRAND_RELAYS: 'http://api.drand.sh' })).toThrow(
      'DRAND_RELAYS',
    );
    expect(() => v({ DRAND_RELAYS: ' , ' })).toThrow('DRAND_RELAYS');
    expect(
      v({ DRAND_RELAYS: 'https://api.drand.sh, https://api2.drand.sh' })
        .DRAND_RELAYS,
    ).toBe('https://api.drand.sh, https://api2.drand.sh');
  });

  it('refuses a seed key in the environment in production', () => {
    expect(() =>
      v({
        NODE_ENV: 'production',
        SEED_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
      }),
    ).toThrow('SEED_ENCRYPTION_KEY');
    expect(
      v({
        NODE_ENV: 'test',
        SEED_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
      }).SEED_ENCRYPTION_KEY,
    ).toBeDefined();
  });

  it('refuses at startup a drand chain hash that does not match its key, without network', () => {
    expect(() =>
      v({ DRAND_CHAIN_HASH: 'ab'.repeat(32) }),
    ).toThrow('DRAND_CHAIN_HASH');
    expect(() => v({ DRAND_PERIOD_SECONDS: '30' })).toThrow(
      'DRAND_CHAIN_HASH',
    );
  });

  it('skips the drand check when the jobs are off, as nothing draws', () => {
    expect(
      v({ JOBS_ENABLED: 'false', DRAND_CHAIN_HASH: 'ab'.repeat(32) })
        .JOBS_ENABLED,
    ).toBe(false);
  });

  describe('HTTP API, access links and emails (F6)', () => {
    const production = {
      NODE_ENV: 'production',
      JWT_SECRET: 'p'.repeat(40),
      NOTIFICATIONS_URL: 'https://notify.example.com',
      NOTIFICATIONS_SERVICE_TOKEN: 'service-token',
      MAGIC_LINK_BASE_URL: 'https://rifas.example.com/acceso',
      CORS_ORIGINS: 'https://rifas.example.com',
    };
    const development = { NODE_ENV: 'development', JWT_SECRET: 'd'.repeat(40) };

    it('needs NODE_ENV: nothing defaults to an environment', () => {
      expect(() => validateEnv({})).toThrow('NODE_ENV');
    });

    it('gives JWT_SECRET a default only under tests', () => {
      expect(v().JWT_SECRET).toBeDefined();
      expect(() => v({ NODE_ENV: 'development', EMAIL_LOG_ONLY: 'true' })).toThrow('JWT_SECRET');
    });

    it('refuses to start with no email service and no explicit opt-in to log emails', () => {
      expect(() => v(development)).toThrow('EMAIL_LOG_ONLY');
      expect(v({ ...development, EMAIL_LOG_ONLY: 'true' }).EMAIL_LOG_ONLY).toBe(true);
    });

    it('allows logging emails instead of sending them in development only', () => {
      expect(() => v({ ...production, EMAIL_LOG_ONLY: 'true' })).toThrow('EMAIL_LOG_ONLY');
      expect(() => v({ EMAIL_LOG_ONLY: 'true' })).toThrow('EMAIL_LOG_ONLY');
    });

    it('trusts only the loopback proxy by default, and never every peer', () => {
      expect(v().TRUST_PROXY).toBe('loopback');
      expect(() => v({ TRUST_PROXY: 'true' })).toThrow('TRUST_PROXY');
    });

    it('needs explicit CORS origins in production, never a wildcard', () => {
      expect(v().CORS_ORIGINS).toBe('http://localhost:4200');
      expect(() => v({ ...production, CORS_ORIGINS: '' })).toThrow('CORS_ORIGINS');
      expect(() => v({ ...production, CORS_ORIGINS: '*' })).toThrow('CORS_ORIGINS');
    });

    it('has no unused session setting', () => {
      expect(Object.keys(envSchema.shape)).not.toContain('JWT_EXPIRES_IN');
    });

    it('defaults the access links and sessions of D4', () => {
      const env = v({});

      expect(env.MAGIC_LINK_TTL_MINUTES).toBe(15);
      expect(env.MAGIC_LINK_MAX_PER_WINDOW).toBe(3);
      expect(env.SESSION_TTL_HOURS).toBe(720);
      expect(env.NOTIFICATIONS_TIMEOUT_MS).toBe(10_000);
      expect(env.RATE_LIMIT_RESERVATION_PER_MINUTE).toBe(10);
      expect(env.RATE_LIMIT_PROOF_PER_MINUTE).toBe(5);
      expect(env.RATE_LIMIT_MAGIC_LINK_PER_15_MINUTES).toBe(5);
      expect(env.RATE_LIMIT_AUTH_PER_MINUTE).toBe(10);
    });

    it('starts in production with its own secret, the email service and the link page', () => {
      expect(v(production).NODE_ENV).toBe('production');
    });

    it('refuses the development JWT secret in production', () => {
      const { JWT_SECRET: _omitted, ...rest } = production;
      expect(() => v(rest)).toThrow('JWT_SECRET');
    });

    it('refuses production without the email service: nobody could sign in (D5)', () => {
      expect(() =>
        v({ ...production, NOTIFICATIONS_SERVICE_TOKEN: undefined }),
      ).toThrow('NOTIFICATIONS_URL');
      expect(() =>
        v({ ...production, NOTIFICATIONS_URL: undefined }),
      ).toThrow('NOTIFICATIONS_URL');
    });

    it('refuses production without the page that opens the access link', () => {
      expect(() =>
        v({ ...production, MAGIC_LINK_BASE_URL: undefined }),
      ).toThrow('MAGIC_LINK_BASE_URL');
    });

    it('refuses a plain-http web page in production: its links go out in emails (DT-20)', () => {
      expect(() =>
        v({ ...production, MAGIC_LINK_BASE_URL: 'http://rifas.example.com/acceso' }),
      ).toThrow('MAGIC_LINK_BASE_URL');
      expect(v({ ...production }).MAGIC_LINK_BASE_URL).toBe('https://rifas.example.com/acceso');
      expect(
        v({ ...development, EMAIL_LOG_ONLY: 'true', MAGIC_LINK_BASE_URL: 'http://192.168.1.5:4200/acceso' })
          .MAGIC_LINK_BASE_URL,
      ).toBe('http://192.168.1.5:4200/acceso');
    });
  });

  it('knows nothing about a payment gateway', () => {
    expect(Object.keys(envSchema.shape).join()).not.toMatch(/CULQI/);
  });
});
