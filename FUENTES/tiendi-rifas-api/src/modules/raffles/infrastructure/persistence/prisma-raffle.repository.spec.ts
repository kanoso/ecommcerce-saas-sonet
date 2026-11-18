import { RaffleStatus } from '../../domain';
import { PrismaRaffleRepository } from './prisma-raffle.repository';

describe('PrismaRaffleRepository.toDomain', () => {
  const record = {
    id: 'r-1',
    title: 'Rifa',
    prize: 'Auto',
    ticketPrice: '10.00',
    numberMin: 1,
    numberMax: 10,
    status: RaffleStatus.CLOSED,
    authorizationResolution: 'RD-1',
    commitmentHash: 'c',
    seedCiphertext: null,
    seedRevealed: 's',
    drandRound: 1000n,
    drandChainHash: 'h',
    soldListHash: 'l',
    salesCloseAt: null,
    drawAt: null,
    cancellationReason: null,
    createdAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-01T00:00:00Z'),
  };

  it('reads when the draw configuration was frozen', () => {
    const frozenAt = new Date('2026-11-10T18:00:01Z');

    const raffle = PrismaRaffleRepository.toDomain({
      ...record,
      drawConfigHash: 'config',
      drawConfigFrozenAt: frozenAt,
    });

    expect(raffle.drawConfigHash).toBe('config');
    expect(raffle.drawConfigFrozenAt).toEqual(frozenAt);
  });

  it('reads a raffle never frozen as null', () => {
    expect(PrismaRaffleRepository.toDomain(record).drawConfigFrozenAt).toBeNull();
  });
});
