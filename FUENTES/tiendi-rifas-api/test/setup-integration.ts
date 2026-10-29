/**
 * Setup default environment variables for integration tests.
 * Dedicated PostgreSQL for Raffles (not SQLite, not mock).
 */
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/rifas?schema=public';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-jwt-secret-for-rifas-min-32-chars-long';
