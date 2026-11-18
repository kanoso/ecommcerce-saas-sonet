import {
  Draw,
  DrawWinner,
  DrawWinnerStatus,
  MissingRaffleDataError,
} from '../../domain';
import { PrismaTicketLedger } from './prisma-ticket-ledger';
import { PrismaService } from './prisma.service';

/**
 * addDraw is the only writer of DrawWinner rows. A raffle row without its
 * RafflePrize rows (written outside the domain) reads back with a prize
 * synthesized from the legacy columns, whose id exists nowhere: the draw must
 * be refused in the domain's words, before anything is written, instead of
 * leaving the foreign key to fail half-way.
 */
describe('PrismaTicketLedger.addDraw', () => {
  function winner(prizeId: string, position: number): DrawWinner {
    return {
      id: `w-${position}`,
      prizeId,
      position,
      status: DrawWinnerStatus.WON,
      ticketId: `t-${position}`,
      winningNumber: position,
      winnerIndex: position - 1,
      digestHex: 'ab'.repeat(32),
      poolSize: 5,
      extractions: [],
      excludedTickets: [position],
    };
  }

  function drawWith(winners: DrawWinner[]): Draw {
    return new Draw({
      id: 'draw-1',
      raffleId: 'raffle-1',
      algorithmVersion: 'v2',
      seedRevealed: 'aa'.repeat(32),
      drandRandomness: 'bb'.repeat(32),
      drandRound: 1000n,
      digestHex: 'ab'.repeat(32),
      totalSold: 5,
      winningTicketId: 't-1',
      winningNumber: 1,
      winnerIndex: 0,
      winners,
    });
  }

  function ledgerWithPrizes(persisted: { id: string; position: number }[]) {
    const tx = {
      rafflePrize: { findMany: jest.fn().mockResolvedValue(persisted) },
      draw: { create: jest.fn().mockResolvedValue({}) },
      drawWinner: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = {
      $transaction: (work: (client: unknown) => Promise<unknown>) => work(tx),
    } as unknown as PrismaService;
    return { ledger: new PrismaTicketLedger(prisma), tx };
  }

  it('refuses a winner whose prize is not persisted, writing nothing', async () => {
    const { ledger, tx } = ledgerWithPrizes([]);

    await expect(
      ledger.run((t) => t.addDraw(drawWith([winner('raffle-1:prize:1', 1)]))),
    ).rejects.toThrow(MissingRaffleDataError);
    expect(tx.rafflePrize.findMany).toHaveBeenCalledWith({
      where: { raffleId: 'raffle-1' },
      select: { id: true, position: true },
    });
    expect(tx.draw.create).not.toHaveBeenCalled();
    expect(tx.drawWinner.createMany).not.toHaveBeenCalled();
  });

  it('refuses a winner whose prize id is persisted at another position', async () => {
    const { ledger, tx } = ledgerWithPrizes([
      { id: 'p-1', position: 1 },
      { id: 'p-2', position: 2 },
    ]);

    await expect(
      ledger.run((t) => t.addDraw(drawWith([winner('p-1', 1), winner('p-1', 2)]))),
    ).rejects.toThrow(MissingRaffleDataError);
    expect(tx.draw.create).not.toHaveBeenCalled();
  });

  it('writes the draw and its winners when every prize is persisted', async () => {
    const { ledger, tx } = ledgerWithPrizes([
      { id: 'p-1', position: 1 },
      { id: 'p-2', position: 2 },
    ]);

    await ledger.run((t) => t.addDraw(drawWith([winner('p-1', 1), winner('p-2', 2)])));

    expect(tx.draw.create).toHaveBeenCalledTimes(1);
    const rows = tx.drawWinner.createMany.mock.calls[0][0].data as { prizeId: string }[];
    expect(rows.map((r) => r.prizeId)).toEqual(['p-1', 'p-2']);
  });
});
