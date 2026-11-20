import { Raffle, RaffleNotFoundError, parseOperatorId } from '../../domain';
import { Clock, LedgerTransaction, TicketLedger } from '../ports';
import { refundRaffleBuyers } from './refund-raffle-buyers';

export interface CancelRaffleCommand {
  raffleId: string;
  /** The operator of the session (DT-17); recorded in RAFFLE_CANCELLED. */
  operatorId: string;
  reason: string;
}

/**
 * Cancels a DRAFT or ACTIVE raffle (POST /admin/rifas/:id/cancelar): every
 * PAID order gets a refund, and the cancel is audited with its operator.
 * A CLOSED raffle has its own exits (DT-15, DT-21).
 */
export class CancelRaffleUseCase {
  constructor(
    private readonly ledger: TicketLedger,
    private readonly clock: Clock,
  ) {}

  async execute(command: CancelRaffleCommand): Promise<Raffle> {
    const operatorId = parseOperatorId(command.operatorId);
    return this.ledger.run((tx) => this.cancel(tx, { ...command, operatorId }));
  }

  private async cancel(
    tx: LedgerTransaction,
    command: CancelRaffleCommand,
  ): Promise<Raffle> {
    const raffle = await tx.lockRaffle(command.raffleId);
    if (!raffle) {
      throw new RaffleNotFoundError(command.raffleId);
    }

    const previousStatus = raffle.status;
    raffle.cancel(command.reason);
    await tx.saveRaffle(raffle, previousStatus);

    const { paidOrders, ordersInReview } = await refundRaffleBuyers(
      tx,
      raffle,
      this.clock.now(),
    );

    await tx.recordAudit({
      raffleId: raffle.id,
      type: 'RAFFLE_CANCELLED',
      data: {
        reason: command.reason,
        operatorId: command.operatorId,
        paidOrdersCount: paidOrders.length,
        ordersInReview: ordersInReview.map((order) => order.id),
      },
    });

    return raffle;
  }
}
