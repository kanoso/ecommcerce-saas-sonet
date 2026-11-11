import { randomUUID } from 'crypto';
import {
  ALGORITHM_VERSION,
  computeWinnerSequence,
  normalizeSoldNumbers,
  soldListHash,
  verifyCommitment,
} from '@kanoso/raffle-draw';
import {
  Draw,
  DrawNotPossibleError,
  MissingRaffleDataError,
  OperatorAlert,
  OperatorAlertType,
  Raffle,
  RaffleStatus,
  SoldListMismatchError,
  WinningTicketWithoutOrderError,
} from '../../domain';
import {
  Clock,
  DrawRepository,
  LedgerTransaction,
  NotificationType,
  RaffleRepository,
  RandomnessBeacon,
  TicketLedger,
  TicketRepository,
} from '../ports';
import { queueNotification } from './queue-notification';

/** The winning ticket has no buyer to tell (DT-13). */
const WITHOUT_ORDER = 'WITHOUT_ORDER' as const;

/** Sold ticket count is lower than required winning attempt. */
const UNDER_THRESHOLD = 'UNDER_THRESHOLD' as const;

/** Another run drew this raffle while this one waited for the lock. */
const ALREADY_DRAWN = 'ALREADY_DRAWN' as const;

/** Marks the raffle's own alerts read when the job gets through. */
export const SYSTEM_OPERATOR = 'system';

interface Refusal {
  expectedHash: string;
  actualHash: string;
  totalSold: number;
}

export class ExecuteDrawUseCase {
  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly ticketRepo: TicketRepository,
    private readonly ledger: TicketLedger,
    private readonly beacon: RandomnessBeacon,
    private readonly clock: Clock,
    private readonly drawRepo: DrawRepository,
  ) {}

  async execute(raffleId: string): Promise<Draw> {
    const raffle = await this.raffleRepo.findById(raffleId);
    if (!raffle) {
      throw new DrawNotPossibleError(`Raffle ${raffleId} not found`);
    }

    // A second run of the job finds the draw already made (§6.4).
    if (raffle.status === RaffleStatus.DRAWN) {
      const done = await this.drawRepo.findByRaffleId(raffleId);
      if (done) {
        return done;
      }
    }

    if (raffle.status !== RaffleStatus.CLOSED) {
      throw new DrawNotPossibleError(
        `Cannot execute draw: raffle must be in CLOSED status (current status: ${raffle.status})`,
      );
    }

    if (
      !raffle.seedRevealed ||
      !raffle.commitmentHash ||
      !raffle.drandRound ||
      !raffle.soldListHash
    ) {
      throw new DrawNotPossibleError(
        `Missing draw parameters for raffle ${raffleId}`,
      );
    }

    // Verify seed commitment
    const isSeedValid = await verifyCommitment(
      raffle.seedRevealed,
      raffle.commitmentHash,
    );
    if (!isSeedValid) {
      throw new DrawNotPossibleError('Seed does not match commitment hash');
    }

    // One read: the list checked here is the list the winner comes from.
    const soldTickets = await this.ticketRepo.findSoldByRaffleId(raffleId);
    const soldNumbers = normalizeSoldNumbers(soldTickets.map((t) => t.number));
    await this.assertListIsTheFrozenOne(raffle, soldNumbers);

    if (soldNumbers.length === 0) {
      throw new DrawNotPossibleError(
        'Cannot execute draw: no tickets were sold',
      );
    }

    // Under-threshold sales guard: soldNumbers.length must be >= raffle.winningAttempt
    if (soldNumbers.length < raffle.winningAttempt) {
      await this.ledger.run(async (tx) => {
        await tx.raiseOperatorAlert(
          new OperatorAlert({
            id: randomUUID(),
            type: OperatorAlertType.DRAW_BLOCKED,
            raffleId: raffle.id,
            raffleTitle: raffle.title,
            orderId: null,
            amount: null,
            reason: 'Boletos vendidos insuficientes para el intento ganador configurado',
            createdAt: this.clock.now(),
          }),
        );
        await tx.recordAudit({
          raffleId: raffle.id,
          type: 'DRAW_REFUSED',
          data: {
            reason: 'UNDER_THRESHOLD',
            sold: soldNumbers.length,
            required: raffle.winningAttempt,
          },
        });
      });
      throw new DrawNotPossibleError(
        `Cannot execute draw: sold tickets (${soldNumbers.length}) less than winning attempt (${raffle.winningAttempt})`,
      );
    }

    // Only the published round, BLS-verified (DT-18). An outage of drand or
    // of its relays only delays the draw: the job keeps waiting for it.
    const beaconRound = await this.beacon.getRound(raffle.drandRound);

    // Compute sequential winner deterministically
    const result = await computeWinnerSequence({
      seedHex: raffle.seedRevealed,
      drandRandomnessHex: beaconRound.randomness,
      raffleId: raffle.id,
      soldNumbers,
      winningAttempt: raffle.winningAttempt,
    });

    const winningTicket = soldTickets.find(
      (t) => t.number === result.winningTicket,
    );
    if (!winningTicket) {
      throw new MissingRaffleDataError(
        `Winning ticket number ${result.winningTicket} not found among sold tickets`,
      );
    }

    const draw = new Draw({
      id: randomUUID(),
      raffleId: raffle.id,
      algorithmVersion: ALGORITHM_VERSION,
      seedRevealed: raffle.seedRevealed,
      drandRandomness: beaconRound.randomness,
      drandRound: beaconRound.round,
      digestHex: result.digestHex,
      totalSold: soldNumbers.length,
      winningTicketId: winningTicket.id,
      winningNumber: result.winningTicket,
      winnerIndex: result.winnerIndex,
      winningAttempt: raffle.winningAttempt,
      extractions: result.extractions,
      executedAt: this.clock.now(),
    });

    const refusal = await this.ledger.run((tx) => this.record(tx, draw));
    if (refusal === ALREADY_DRAWN) {
      const done = await this.drawRepo.findByRaffleId(raffleId);
      if (done) {
        return done;
      }
      throw new MissingRaffleDataError(`Raffle ${raffleId} is DRAWN but has no stored draw`);
    }
    if (refusal === WITHOUT_ORDER) {
      throw new WinningTicketWithoutOrderError(raffle.id, draw.winningNumber);
    }
    if (refusal === UNDER_THRESHOLD) {
      throw new DrawNotPossibleError(
        `Cannot execute draw: sold tickets less than winning attempt (${raffle.winningAttempt})`,
      );
    }
    if (refusal) {
      // After the rollback: the evidence must outlive the refusal.
      await this.refuse(raffle, refusal.expectedHash, refusal.actualHash, {
        totalSold: refusal.totalSold,
        detectedUnderLock: true,
      });
    }
    return draw;
  }

  /**
   * Nobody can be told they won, so the draw stops. The refusal and the
   * operator's alert commit, and nothing of the draw does; trying again
   * reopens the same alert.
   */
  private async blockWithoutOrder(
    tx: LedgerTransaction,
    raffle: Raffle,
    draw: Draw,
  ): Promise<typeof WITHOUT_ORDER> {
    await tx.raiseOperatorAlert(
      new OperatorAlert({
        id: randomUUID(),
        type: OperatorAlertType.DRAW_BLOCKED,
        raffleId: raffle.id,
        raffleTitle: raffle.title,
        orderId: null,
        amount: null,
        reason: 'Boleto ganador no tiene orden de compra asociada',
        createdAt: draw.executedAt,
      }),
    );
    await tx.recordAudit({
      raffleId: raffle.id,
      type: 'DRAW_REFUSED',
      data: {
        reason: 'WINNING_TICKET_WITHOUT_ORDER',
        winningNumber: draw.winningNumber,
        winningTicketId: draw.winningTicketId,
      },
    });
    return WITHOUT_ORDER;
  }

  private async blockUnderThreshold(
    tx: LedgerTransaction,
    raffle: Raffle,
    soldCount: number,
  ): Promise<typeof UNDER_THRESHOLD> {
    await tx.raiseOperatorAlert(
      new OperatorAlert({
        id: randomUUID(),
        type: OperatorAlertType.DRAW_BLOCKED,
        raffleId: raffle.id,
        raffleTitle: raffle.title,
        orderId: null,
        amount: null,
        reason: 'Boletos vendidos insuficientes para el intento ganador configurado',
        createdAt: this.clock.now(),
      }),
    );
    await tx.recordAudit({
      raffleId: raffle.id,
      type: 'DRAW_REFUSED',
      data: {
        reason: 'UNDER_THRESHOLD',
        sold: soldCount,
        required: raffle.winningAttempt,
      },
    });
    return UNDER_THRESHOLD;
  }

  /**
   * The draw, the DRAWN status, the winner's email and the audit commit
   * together (DT-13): no winner is drawn without being told.
   */
  private async record(
    tx: LedgerTransaction,
    draw: Draw,
  ): Promise<Refusal | typeof WITHOUT_ORDER | typeof UNDER_THRESHOLD | typeof ALREADY_DRAWN | null> {
    const raffle = (await tx.lockRaffle(draw.raffleId)) as Raffle;
    // A parallel run of the job won the lock first: same result, no error.
    if (raffle.status === RaffleStatus.DRAWN) {
      return ALREADY_DRAWN;
    }

    // Read again under the lock: the list may have changed since the first
    // read, and the winner must come from the list that is committed.
    const sold = await tx.lockSoldTickets(raffle.id);
    const soldNumbers = normalizeSoldNumbers(sold.map((t) => t.number));

    if (soldNumbers.length < raffle.winningAttempt) {
      return this.blockUnderThreshold(tx, raffle, soldNumbers.length);
    }

    const expectedHash = raffle.soldListHash as string;
    const actualHash = await soldListHash(soldNumbers);
    if (actualHash !== expectedHash) {
      return { expectedHash, actualHash, totalSold: soldNumbers.length };
    }
    // Same hash, same list, same winner: only the ticket row is checked.
    const winningTicket = sold.find((t) => t.id === draw.winningTicketId);
    if (!winningTicket || winningTicket.number !== draw.winningNumber) {
      throw new DrawNotPossibleError(
        `Winning ticket ${draw.winningNumber} of raffle ${raffle.id} changed during the draw`,
      );
    }

    // The ticket holds the order; the email goes to the buyer behind it.
    // Checked before any write of the draw, which then commits nothing.
    const order = winningTicket.orderId
      ? await tx.lockOrder(winningTicket.orderId)
      : null;
    if (!order) {
      return this.blockWithoutOrder(tx, raffle, draw);
    }

    raffle.markDrawn();
    await tx.saveRaffle(raffle, RaffleStatus.CLOSED);
    await tx.addDraw(draw);

    await queueNotification(
      tx,
      order,
      {
        type: NotificationType.WINNER,
        recipient: order.userId,
        payload: {
          raffleId: raffle.id,
          raffleTitle: raffle.title,
          winningNumber: draw.winningNumber,
          prize: raffle.prize,
        },
      },
      draw.executedAt,
      draw.id,
    );

    // A draw that got through after an outage closes its own alert.
    await tx.clearRaffleAlert(
      OperatorAlertType.DRAW_BLOCKED,
      raffle.id,
      SYSTEM_OPERATOR,
      draw.executedAt,
    );

    await tx.recordAudit({
      raffleId: raffle.id,
      type: 'DRAW_EXECUTED',
      data: {
        winningNumber: draw.winningNumber,
        winnerIndex: draw.winnerIndex,
        drandRound: draw.drandRound.toString(),
        drandRandomness: draw.drandRandomness,
        digestHex: draw.digestHex,
        totalSold: draw.totalSold,
        winningAttempt: draw.winningAttempt,
        extractions: draw.extractions,
      },
    });
    return null;
  }

  private async assertListIsTheFrozenOne(
    raffle: Raffle,
    soldNumbers: number[],
  ): Promise<void> {
    const expectedHash = raffle.soldListHash as string;
    const actualHash = await soldListHash(soldNumbers);
    if (actualHash === expectedHash) {
      return;
    }

    await this.refuse(raffle, expectedHash, actualHash, {
      totalSold: soldNumbers.length,
    });
  }

  /**
   * Its own transaction, apart from the draw's: the evidence and the
   * operator's alert must outlive the refusal. Cancelling the raffle is the
   * only exit (DT-15), and trying again reopens the same alert.
   */
  private async refuse(
    raffle: Raffle,
    expectedHash: string,
    actualHash: string,
    details: Record<string, unknown>,
  ): Promise<never> {
    await this.ledger.run(async (tx) => {
      await tx.raiseOperatorAlert(
        new OperatorAlert({
          id: randomUUID(),
          type: OperatorAlertType.DRAW_BLOCKED,
          raffleId: raffle.id,
          raffleTitle: raffle.title,
          orderId: null,
          amount: null,
          createdAt: this.clock.now(),
        }),
      );
      await tx.recordAudit({
        raffleId: raffle.id,
        type: 'DRAW_REFUSED',
        data: {
          reason: 'SOLD_LIST_MISMATCH',
          expectedHash,
          actualHash,
          ...details,
        },
      });
    });
    throw new SoldListMismatchError(raffle.id, expectedHash, actualHash);
  }
}
