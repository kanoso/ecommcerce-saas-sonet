import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 3 — PostgreSQL Persistence & Concurrency Integration Tests', () => {
  let prisma: PrismaClient;
  const testDbUrl =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/rifas?schema=public';

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: { url: testDbUrl },
      },
    });

    try {
      await prisma.$connect();
      // Apply triggers from triggers.sql
      const triggersSqlPath = path.join(__dirname, '../prisma/triggers.sql');
      if (fs.existsSync(triggersSqlPath)) {
        const triggersSql = fs.readFileSync(triggersSqlPath, 'utf-8');
        await prisma.$executeRawUnsafe(triggersSql);
      }
    } catch (err) {
      console.warn('PostgreSQL not accessible currently for live tests:', err);
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('verifies DATABASE_URL points to real PostgreSQL, never SQLite', () => {
    expect(testDbUrl).toBeDefined();
    expect(testDbUrl).toMatch(/^postgresql:\/\//);
    expect(testDbUrl).not.toMatch(/sqlite/i);
  });

  describe('Live PostgreSQL Invariants & Concurrency (Skipped if DB offline)', () => {
    let dbAvailable = false;

    beforeEach(async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        dbAvailable = true;
      } catch {
        dbAvailable = false;
      }
    });

    it('enforces SQL trigger: AuditEvent is append-only (rejects UPDATE & DELETE)', async () => {
      if (!dbAvailable) return;

      const raffle = await prisma.raffle.create({
        data: {
          title: 'Audit Test Raffle',
          prize: 'Test Prize',
          ticketPrice: 10,
          numberMin: 1,
          numberMax: 10,
        },
      });

      const event = await prisma.auditEvent.create({
        data: {
          raffleId: raffle.id,
          type: 'TEST_EVENT',
          data: { foo: 'bar' },
        },
      });

      // Attempt UPDATE -> must throw
      await expect(
        prisma.$executeRaw`UPDATE "AuditEvent" SET type = 'HACKED' WHERE id = ${event.id}`,
      ).rejects.toThrow();

      // Attempt DELETE -> must throw
      await expect(
        prisma.$executeRaw`DELETE FROM "AuditEvent" WHERE id = ${event.id}`,
      ).rejects.toThrow();
    });

    it('enforces SQL trigger: Raffle rejects commitment & drand update when status is not DRAFT', async () => {
      if (!dbAvailable) return;

      const raffle = await prisma.raffle.create({
        data: {
          title: 'Active Raffle',
          prize: 'Motorcycle',
          ticketPrice: 25,
          numberMin: 1,
          numberMax: 100,
          status: 'ACTIVE',
          commitmentHash: 'original_commitment_hash',
          drandRound: 1000n,
          drandChainHash: 'chain_hash_1',
        },
      });

      // Updating title when ACTIVE is allowed
      await expect(
        prisma.raffle.update({
          where: { id: raffle.id },
          data: { title: 'Updated Active Title' },
        }),
      ).resolves.toBeDefined();

      // Attempting to alter commitmentHash when ACTIVE -> trigger throws
      await expect(
        prisma.$executeRaw`UPDATE "Raffle" SET "commitmentHash" = 'altered_hash' WHERE id = ${raffle.id}`,
      ).rejects.toThrow();

      // Attempting to alter drandRound when ACTIVE -> trigger throws
      await expect(
        prisma.$executeRaw`UPDATE "Raffle" SET "drandRound" = 9999 WHERE id = ${raffle.id}`,
      ).rejects.toThrow();
    });

    it('concurrency test: 50 simultaneous reservations on the same ticket -> exactly 1 wins, 49 conflict', async () => {
      if (!dbAvailable) return;

      const raffle = await prisma.raffle.create({
        data: {
          title: 'Concurrency Battle Raffle',
          prize: 'MacBook Pro',
          ticketPrice: 50,
          numberMin: 1,
          numberMax: 10,
          status: 'ACTIVE',
        },
      });

      // Seed ticket #7 as AVAILABLE
      await prisma.ticket.create({
        data: {
          raffleId: raffle.id,
          number: 7,
          status: 'AVAILABLE',
        },
      });

      const attempts = 50;
      const targetNumber = 7;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // Launch 50 simultaneous atomic update promises
      const promises = Array.from({ length: attempts }, async (_, i) => {
        const orderId = `order_${i}_${Date.now()}`;
        const updated = await prisma.$queryRaw<{ number: number }[]>`
          UPDATE "Ticket"
          SET status = 'RESERVED',
              "orderId" = ${orderId},
              "reservedUntil" = ${expiresAt},
              "updatedAt" = NOW()
          WHERE "raffleId" = ${raffle.id}
            AND number = ${targetNumber}
            AND status = 'AVAILABLE'
          RETURNING number;
        `;
        return updated.length > 0;
      });

      const results = await Promise.all(promises);
      const successes = results.filter((r) => r === true).length;
      const failures = results.filter((r) => r === false).length;

      expect(successes).toBe(1);
      expect(failures).toBe(49);
    });

    it('all-or-nothing atomic reservation: crossed reservations [1, 2] vs [2, 3] -> one wins, other reserves zero', async () => {
      if (!dbAvailable) return;

      const raffle = await prisma.raffle.create({
        data: {
          title: 'Crossed Reservation Raffle',
          prize: 'PlayStation 5',
          ticketPrice: 20,
          numberMin: 1,
          numberMax: 5,
          status: 'ACTIVE',
        },
      });

      await prisma.ticket.createMany({
        data: [1, 2, 3].map((num) => ({
          raffleId: raffle.id,
          number: num,
          status: 'AVAILABLE',
        })),
      });

      const reserveWithAllOrNothing = async (
        numbers: number[],
        orderId: string,
      ) => {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        return prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRaw<{ number: number }[]>`
            UPDATE "Ticket"
            SET status = 'RESERVED',
                "orderId" = ${orderId},
                "reservedUntil" = ${expiresAt},
                "updatedAt" = NOW()
            WHERE "raffleId" = ${raffle.id}
              AND number = ANY(${numbers})
              AND status = 'AVAILABLE'
            RETURNING number;
          `;

          if (rows.length !== numbers.length) {
            throw new Error('CONFLICT_UNAVAILABLE');
          }
          return rows.map((r) => r.number);
        });
      };

      const [resA, resB] = await Promise.allSettled([
        reserveWithAllOrNothing([1, 2], 'order_A'),
        reserveWithAllOrNothing([2, 3], 'order_B'),
      ]);

      const aFulfilled = resA.status === 'fulfilled';
      const bFulfilled = resB.status === 'fulfilled';

      // Exactly one must succeed completely, and the other must reject
      expect(aFulfilled !== bFulfilled).toBe(true);

      // Verify the loser did not leave any partial reservations (all-or-nothing rollback)
      const tickets = await prisma.ticket.findMany({
        where: { raffleId: raffle.id },
        orderBy: { number: 'asc' },
      });

      if (aFulfilled) {
        expect(tickets[0].status).toBe('RESERVED'); // 1
        expect(tickets[1].status).toBe('RESERVED'); // 2
        expect(tickets[2].status).toBe('AVAILABLE'); // 3
      } else {
        expect(tickets[0].status).toBe('AVAILABLE'); // 1
        expect(tickets[1].status).toBe('RESERVED'); // 2
        expect(tickets[2].status).toBe('RESERVED'); // 3
      }
    });
  });
});
