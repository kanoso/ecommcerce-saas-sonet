/**
 * Environment for integration tests. They run against the disposable
 * `postgres-test` compose service, never against a development database.
 * An inherited DATABASE_URL is ignored on purpose; use TEST_DATABASE_URL to
 * point at another disposable database.
 */
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:55432/rifas_test?schema=public';

const databaseName = new URL(testDatabaseUrl).pathname.slice(1);
if (!databaseName.endsWith('_test')) {
  throw new Error(
    `Refusing to run integration tests: database "${databaseName}" does not end in "_test"`,
  );
}

process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.DATABASE_URL = testDatabaseUrl;
// The disposable redis-test service. An inherited REDIS_URL is ignored on
// purpose, as with the database: port 6379 belongs to another project.
process.env.REDIS_URL =
  process.env.TEST_REDIS_URL || 'redis://localhost:55379';
process.env.SEED_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
// quicknet, fixed here: Prisma loads the project's env file into
// process.env without overriding what is already set, so these win.
process.env.DRAND_CHAIN_HASH =
  '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971';
process.env.DRAND_PUBLIC_KEY =
  '83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a';
process.env.DRAND_PERIOD_SECONDS = '3';
process.env.DRAND_GENESIS_TIME = '1692803367';
process.env.DRAND_GROUP_HASH =
  'f477d5c89f21a17c863a7f937c6a6d15859414d2be09cd448d4279af331c5d3e';
process.env.DRAND_BEACON_ID = 'quicknet';
process.env.JOBS_ENABLED = 'true';
process.env.JWT_SECRET = 'test-jwt-secret-for-rifas-min-32-chars-long';
// A development env file may set EMAIL_LOG_ONLY=true, which validation
// rejects outside development. Prisma would load it into process.env.
process.env.EMAIL_LOG_ONLY = 'false';
