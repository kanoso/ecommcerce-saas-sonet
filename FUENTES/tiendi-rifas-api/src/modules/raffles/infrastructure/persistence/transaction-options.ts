// Bursts on a popular number queue on the connection pool and on row locks,
// well past Prisma's defaults (2 s wait, 5 s run).
export const TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 20_000 };
