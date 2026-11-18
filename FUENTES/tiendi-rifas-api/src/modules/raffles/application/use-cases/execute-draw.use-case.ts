import { randomUUID } from 'crypto';
import {
  ALGORITHM_VERSION,
  computeMultiPrizeWinners,
  computeWinnerSequence,
  normalizeSoldNumbers,
  soldListHash,
  timeOfRound,
  verifyCommitment,
} from '@kanoso/raffle-draw';
import {
  DRAW_ALGORITHM_V2,
  Draw,
  DrawNotPossibleError,
  DrawWinner,
  DrawWinnerStatus,
  MissingRaffleDataError,
  OperatorAlert,
  OperatorAlertType,
  Raffle,
  RaffleStatus,
  SoldListMismatchError,
  Ticket,
  TicketOrder,
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
import {
  algorithmVersionOf,
  buyerGroupsFor,
  drawConfigHashOf,
  drawConfigOf,
} from './draw-config';
import { DRAW_REFUSED, DrawConfigRefusal } from './draw-refusals';
import { queueNotification } from './queue-notification';

/** A winning ticket has no buyer to tell (DT-13). */
interface WithoutOrder {
  kind: 'WITHOUT_ORDER';
  winningNumber: number;
}

/** Sold ticket count is lower than required winning attempt (v1 only). */
const UNDER_THRESHOLD = 'UNDER_THRESHOLD' as const;

/** Another run drew this raffle while this one waited for the lock. */
const ALREADY_DRAWN = 'ALREADY_DRAWN' as const;

/** The draw configuration no longer hashes to the value frozen at the close (v2). */
interface ConfigMismatch {
  kind: 'CONFIG_MISMATCH';
  expectedHash: string;
  actualHash: string;
}

/** Marks the raffle's own alerts read when the job gets through. */
export const SYSTEM_OPERATOR = 'system';

interface Refusal {
  expectedHash: string;
  actualHash: string;
  totalSold: number;
}

type RecordOutcome =
  | Refusal
  | WithoutOrder
  | typeof UNDER_THRESHOLD
  | typeof ALREADY_DRAWN
  | ConfigMismatch
  | null;

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

    const draw =
      algorithmVersionOf(raffle) === DRAW_ALGORITHM_V2
        ? await this.drawMultiPrize(raffle, soldTickets, soldNumbers)
        : await this.drawSinglePrize(raffle, soldTickets, soldNumbers);

    const refusal = await this.ledger.run((tx) => this.record(tx, draw));
    if (refusal === ALREADY_DRAWN) {
      const done = await this.drawRepo.findByRaffleId(raffleId);
      if (done) {
        return done;
      }
      throw new MissingRaffleDataError(`Raffle ${raffleId} is DRAWN but has no stored draw`);
    }
    if (refusal === UNDER_THRESHOLD) {
      throw new DrawNotPossibleError(
        `Cannot execute draw: sold tickets less than winning attempt (${raffle.winningAttempt})`,
      );
    }
    if (refusal && 'kind' in refusal && refusal.kind === 'CONFIG_MISMATCH') {
      // After the rollback: the evidence must outlive the refusal.
      return this.refuseConfig(raffle, refusal.expectedHash, refusal.actualHash, {
        detectedUnderLock: true,
      });
    }
    if (refusal && 'kind' in refusal && refusal.kind === 'WITHOUT_ORDER') {
      throw new WinningTicketWithoutOrderError(raffle.id, refusal.winningNumber);
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

  /** v1: computeWinnerSequence, exactly as before multi-prize draws. */
  private async drawSinglePrize(
    raffle: Raffle,
    soldTickets: Ticket[],
    soldNumbers: number[],
  ): Promise<Draw> {
    // Under-threshold sales guard: soldNumbers.length must be >= raffle.winningAttempt
    if (soldNumbers.length < raffle.winningAttempt) {
      await this.ledger.run((tx) =>
        this.blockUnderThreshold(tx, raffle, soldNumbers.length),
      );
      throw new DrawNotPossibleError(
        `Cannot execute draw: sold tickets (${soldNumbers.length}) less than winning attempt (${raffle.winningAttempt})`,
      );
    }

    // Only the published round, BLS-verified (DT-18). An outage of drand or
    // of its relays only delays the draw: the job keeps waiting for it.
    const beaconRound = await this.beacon.getRound(raffle.drandRound as bigint);

    const result = await computeWinnerSequence({
      seedHex: raffle.seedRevealed as string,
      drandRandomnessHex: beaconRound.randomness,
      raffleId: raffle.id,
      soldNumbers,
      winningAttempt: raffle.winningAttempt,
    });

    const winningTicket = this.ticketOf(soldTickets, result.winningTicket);
    const winner: DrawWinner = {
      id: randomUUID(),
      prizeId: raffle.prizes[0].id,
      position: 1,
      status: DrawWinnerStatus.WON,
      ticketId: winningTicket.id,
      winningNumber: result.winningTicket,
      winnerIndex: result.winnerIndex,
      digestHex: result.digestHex,
      poolSize: soldNumbers.length,
      extractions: result.extractions,
      excludedTickets: [result.winningTicket],
    };

    return new Draw({
      id: randomUUID(),
      raffleId: raffle.id,
      algorithmVersion: ALGORITHM_VERSION,
      seedRevealed: raffle.seedRevealed as string,
      drandRandomness: beaconRound.randomness,
      drandRound: beaconRound.round,
      digestHex: result.digestHex,
      totalSold: soldNumbers.length,
      winningTicketId: winningTicket.id,
      winningNumber: result.winningTicket,
      winnerIndex: result.winnerIndex,
      winningAttempt: raffle.winningAttempt,
      extractions: result.extractions,
      winners: [winner],
      executedAt: this.clock.now(),
    });
  }

  /**
   * v2: computeMultiPrizeWinners over the configuration frozen at the close.
   * A pool too small for a prize voids it and the later ones: never a refusal.
   */
  private async drawMultiPrize(
    raffle: Raffle,
    soldTickets: Ticket[],
    soldNumbers: number[],
  ): Promise<Draw> {
    if (!raffle.drawConfigHash) {
      return this.refuseMissingConfig(raffle);
    }

    await this.assertFrozenBeforeRound(raffle);

    const buyerGroups = await this.ledger.run((tx) =>
      buyerGroupsFor(tx, raffle, soldTickets),
    );
    const configHash = await drawConfigHashOf(raffle, buyerGroups);
    if (configHash !== raffle.drawConfigHash) {
      await this.refuseConfig(raffle, raffle.drawConfigHash, configHash);
    }

    const beaconRound = await this.beacon.getRound(raffle.drandRound as bigint);

    const result = await computeMultiPrizeWinners({
      seedHex: raffle.seedRevealed as string,
      drandRandomnessHex: beaconRound.randomness,
      raffleId: raffle.id,
      soldNumbers,
      ...drawConfigOf(raffle, buyerGroups),
    });

    const prizes = raffle.prizes;
    const winners: DrawWinner[] = result.prizes.map((p) => ({
      id: randomUUID(),
      prizeId: prizes[p.position - 1].id,
      position: p.position,
      status: p.status === 'WON' ? DrawWinnerStatus.WON : DrawWinnerStatus.VOID,
      ticketId:
        p.winningTicket === null ? null : this.ticketOf(soldTickets, p.winningTicket).id,
      winningNumber: p.winningTicket,
      winnerIndex: p.winnerIndex,
      digestHex: p.digestHex,
      poolSize: p.poolSize,
      extractions: p.extractions,
      excludedTickets: p.excludedTickets,
    }));
    const first = winners[0];

    return new Draw({
      id: randomUUID(),
      raffleId: raffle.id,
      algorithmVersion: result.algorithmVersion,
      seedRevealed: raffle.seedRevealed as string,
      drandRandomness: beaconRound.randomness,
      drandRound: beaconRound.round,
      digestHex: first.digestHex,
      totalSold: soldNumbers.length,
      winningTicketId: first.ticketId,
      winningNumber: first.winningNumber,
      winnerIndex: first.winnerIndex,
      winningAttempt: raffle.winningAttempt,
      extractions: first.extractions,
      winners,
      executedAt: this.clock.now(),
    });
  }

  private ticketOf(soldTickets: Ticket[], number: number): Ticket {
    const ticket = soldTickets.find((t) => t.number === number);
    if (!ticket) {
      throw new MissingRaffleDataError(
        `Winning ticket number ${number} not found among sold tickets`,
      );
    }
    return ticket;
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
    winner: DrawWinner,
  ): Promise<WithoutOrder> {
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
        winningNumber: winner.winningNumber,
        winningTicketId: winner.ticketId,
        ...(draw.algorithmVersion === DRAW_ALGORITHM_V2 && {
          prizePosition: winner.position,
        }),
      },
    });
    return { kind: 'WITHOUT_ORDER', winningNumber: winner.winningNumber as number };
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
   * The draw, the DRAWN status, the winners' emails and the audit commit
   * together (DT-13): no winner is drawn without being told.
   */
  private async record(tx: LedgerTransaction, draw: Draw): Promise<RecordOutcome> {
    const raffle = (await tx.lockRaffle(draw.raffleId)) as Raffle;
    // A parallel run of the job won the lock first: same result, no error.
    if (raffle.status === RaffleStatus.DRAWN) {
      return ALREADY_DRAWN;
    }
    const multiPrize = draw.algorithmVersion === DRAW_ALGORITHM_V2;

    // Read again under the lock: the list may have changed since the first
    // read, and the winner must come from the list that is committed.
    const sold = await tx.lockSoldTickets(raffle.id);
    const soldNumbers = normalizeSoldNumbers(sold.map((t) => t.number));

    if (!multiPrize && soldNumbers.length < raffle.winningAttempt) {
      return this.blockUnderThreshold(tx, raffle, soldNumbers.length);
    }

    const expectedHash = raffle.soldListHash as string;
    const actualHash = await soldListHash(soldNumbers);
    if (actualHash !== expectedHash) {
      return { expectedHash, actualHash, totalSold: soldNumbers.length };
    }

    if (multiPrize) {
      const configHash = await drawConfigHashOf(
        raffle,
        await buyerGroupsFor(tx, raffle, sold),
      );
      if (configHash !== raffle.drawConfigHash) {
        return {
          kind: 'CONFIG_MISMATCH',
          expectedHash: raffle.drawConfigHash as string,
          actualHash: configHash,
        };
      }
    }

    // Same hash, same list, same winners: only the ticket rows are checked.
    const won = draw.winners.filter((w) => w.status === DrawWinnerStatus.WON);
    for (const winner of won) {
      const ticket = sold.find((t) => t.id === winner.ticketId);
      if (!ticket || ticket.number !== winner.winningNumber) {
        throw new DrawNotPossibleError(
          `Winning ticket ${winner.winningNumber} of raffle ${raffle.id} changed during the draw`,
        );
      }
    }

    // The ticket holds the order; the email goes to the buyer behind it.
    // Checked before any write of the draw, which then commits nothing.
    const orders: TicketOrder[] = [];
    for (const winner of won) {
      const ticket = sold.find((t) => t.id === winner.ticketId) as Ticket;
      const order = ticket.orderId ? await tx.lockOrder(ticket.orderId) : null;
      if (!order) {
        return this.blockWithoutOrder(tx, raffle, draw, winner);
      }
      orders.push(order);
    }

    raffle.markDrawn();
    await tx.saveRaffle(raffle, RaffleStatus.CLOSED);
    await tx.addDraw(draw);

    const prizes = raffle.prizes;
    for (const [i, winner] of won.entries()) {
      const order = orders[i];
      await queueNotification(
        tx,
        order,
        {
          type: NotificationType.WINNER,
          recipient: order.userId,
          payload: {
            raffleId: raffle.id,
            raffleTitle: raffle.title,
            winningNumber: winner.winningNumber as number,
            prize: prizes[winner.position - 1].title,
            ...(multiPrize && {
              prizePosition: winner.position,
              prizeCount: prizes.length,
            }),
          },
        },
        draw.executedAt,
        // One email per winning ticket: a buyer can win several prizes.
        multiPrize ? `${draw.id}:prize:${winner.position}` : draw.id,
      );
    }

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
        ...(multiPrize && {
          algorithmVersion: draw.algorithmVersion,
          winnerExclusionMode: raffle.winnerExclusionMode,
          drawConfigHash: raffle.drawConfigHash,
          winners: draw.winners.map((w) => ({
            position: w.position,
            prizeId: w.prizeId,
            status: w.status,
            winningNumber: w.winningNumber,
            poolSize: w.poolSize,
            excludedTickets: w.excludedTickets,
            extractions: w.extractions,
          })),
        }),
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

  /**
   * v2's configuration is honest only if it was frozen before anyone could
   * know the round's randomness: the round is published at
   * genesis + (round - 1) * period. A close that ran at or after that
   * instant (a late close job) cannot prove it, so the draw refuses, before
   * the beacon is even asked. Cancelling is the only exit (DT-15).
   */
  private async assertFrozenBeforeRound(raffle: Raffle): Promise<void> {
    const chain = await this.beacon.getChainInfo();
    const publishedAt = new Date(timeOfRound(Number(raffle.drandRound), chain));
    const frozenAt = raffle.drawConfigFrozenAt;
    if (frozenAt && frozenAt.getTime() < publishedAt.getTime()) {
      return;
    }

    await this.ledger.run(async (tx) => {
      await tx.raiseOperatorAlert(
        new OperatorAlert({
          id: randomUUID(),
          type: OperatorAlertType.DRAW_BLOCKED,
          raffleId: raffle.id,
          raffleTitle: raffle.title,
          orderId: null,
          amount: null,
          reason:
            'La configuración del sorteo se congeló cuando la ronda de drand ya era pública',
          createdAt: this.clock.now(),
        }),
      );
      await tx.recordAudit({
        raffleId: raffle.id,
        type: DRAW_REFUSED,
        data: {
          reason: DrawConfigRefusal.FROZEN_LATE,
          drawConfigFrozenAt: frozenAt?.toISOString() ?? null,
          roundPublishedAt: publishedAt.toISOString(),
          drandRound: (raffle.drandRound as bigint).toString(),
        },
      });
    });
    throw new DrawNotPossibleError(
      `Draw configuration of raffle ${raffle.id} was not frozen before drand round ${String(
        raffle.drandRound,
      )} was published`,
    );
  }

  /**
   * A multi-prize raffle reached its draw with no configuration frozen at the
   * close: nothing proves the mode and the buyer groups predate the round.
   * Recorded like the other configuration refusals, so the operator can
   * cancel the raffle with a full refund (DT-21).
   */
  private async refuseMissingConfig(raffle: Raffle): Promise<never> {
    await this.ledger.run(async (tx) => {
      await tx.raiseOperatorAlert(
        new OperatorAlert({
          id: randomUUID(),
          type: OperatorAlertType.DRAW_BLOCKED,
          raffleId: raffle.id,
          raffleTitle: raffle.title,
          orderId: null,
          amount: null,
          reason: 'La rifa llegó al sorteo sin una configuración congelada al cierre',
          createdAt: this.clock.now(),
        }),
      );
      await tx.recordAudit({
        raffleId: raffle.id,
        type: DRAW_REFUSED,
        data: { reason: DrawConfigRefusal.MISSING },
      });
    });
    throw new DrawNotPossibleError(
      `Raffle ${raffle.id} has several prizes but no draw configuration frozen at the close`,
    );
  }

  /**
   * The exclusion mode or the buyer of a ticket changed after the close: the
   * frozen configuration cannot be honoured. Same evidence trail as a
   * mismatching sold list.
   */
  private async refuseConfig(
    raffle: Raffle,
    expectedHash: string,
    actualHash: string,
    details: Record<string, unknown> = {},
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
          reason: 'La configuración del sorteo no coincide con la congelada al cierre',
          createdAt: this.clock.now(),
        }),
      );
      await tx.recordAudit({
        raffleId: raffle.id,
        type: DRAW_REFUSED,
        data: {
          reason: DrawConfigRefusal.MISMATCH,
          expectedHash,
          actualHash,
          winnerExclusionMode: raffle.winnerExclusionMode,
          ...details,
        },
      });
    });
    throw new DrawNotPossibleError(
      `Draw configuration of raffle ${raffle.id} does not match the hash frozen at the close`,
    );
  }
}
