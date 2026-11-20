import { PrismaDrawRepository } from './prisma-draw.repository';
import { PrismaService } from './prisma.service';

describe('PrismaDrawRepository.findByRaffleId: who ran the draw (DT-24)', () => {
  const record = (executedByKind: unknown, executedBy: string | null = null) => ({
    id: 'd-1',
    raffleId: 'r-1',
    algorithmVersion: 'v1',
    seedRevealed: 's',
    drandRandomness: 'r',
    drandRound: 1000n,
    digestHex: 'dd',
    totalSold: 1,
    winningTicketId: null,
    winningNumber: null,
    winnerIndex: null,
    winningAttempt: 1,
    extractions: [],
    executedAt: new Date('2026-11-21T20:00:00Z'),
    executedBy,
    executedByKind,
    winners: [],
  });
  const repoReading = (row: unknown) =>
    new PrismaDrawRepository({
      draw: { findUnique: jest.fn().mockResolvedValue(row) },
    } as unknown as PrismaService);

  it('reads an ADMIN draw with its operator', async () => {
    const draw = await repoReading(record('ADMIN', 'op-1')).findByRaffleId('r-1');

    expect(draw?.executedByKind).toBe('ADMIN');
    expect(draw?.executedBy).toBe('op-1');
  });

  it('reads a legacy draw without a kind as null', async () => {
    const draw = await repoReading(record(null)).findByRaffleId('r-1');

    expect(draw?.executedByKind).toBeNull();
  });

  it('refuses a stored kind it does not know', async () => {
    await expect(repoReading(record('ROBOT')).findByRaffleId('r-1')).rejects.toThrow(
      /executor kind/,
    );
  });
});
