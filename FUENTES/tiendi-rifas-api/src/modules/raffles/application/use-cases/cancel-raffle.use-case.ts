import { Raffle, RaffleNotFoundError } from '../../domain';
import { Clock, LedgerTransaction, TicketLedger } from '../ports';
import { refundRaffleBuyers } from './refund-raffle-buyers';

export interface CancelRaffleCommand {
  raffleId: string;
  reason: string;
}

export class CancelRaffleUseCase {
  constructor(
    private readonly ledger: TicketLedger,
    private readonly clock: Clock,
  ) {}

  async execute(command: CancelRaffleCommand): Promise<Raffle> {
    return this.ledger.run((tx) => this.cancel(tx, command));
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
        paidOrdersCount: paidOrders.length,
        ordersInReview: ordersInReview.map((order) => order.id),
      },
    });

    return raffle;
  }
}
