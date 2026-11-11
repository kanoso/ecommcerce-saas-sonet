import { normalizeSoldNumbers, soldListHash } from '@kanoso/raffle-draw';
import {
  OperatorAlertType,
  MissingRaffleDataError,
  Raffle,
  RaffleNotFoundError,
  RaffleStatus,
} from '../../domain';
import {
  Clock,
  LedgerTransaction,
  RaffleRepository,
  SeedVault,
  TicketLedger,
} from '../ports';
import { SYSTEM_OPERATOR } from './execute-draw.use-case';
import { resolveUnsettledOrders } from './payment-review';

const REASON = 'Sales closed before the payment was verified';

export class CloseSalesUseCase {
  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly ledger: TicketLedger,
    private readonly seedVault: SeedVault,
    private readonly clock: Clock,
  ) {}

  async execute(raffleId: string): Promise<Raffle> {
    const known = await this.raffleRepo.findById(raffleId);
    if (!known) {
      throw new RaffleNotFoundError(raffleId);
    }
    // Already closed, drawn or cancelled: the job ran before (§6.4).
    if (known.status !== RaffleStatus.ACTIVE) {
      return known;
    }
    if (!known.seedCiphertext) {
      throw new MissingRaffleDataError(`Seed ciphertext not found for raffle ${raffleId}`);
    }

    // Before the transaction: no row lock waits on the secrets manager.
    const seedRevealed = await this.seedVault.revealSeed(
      known.id,
      known.seedCiphertext,
    );

    return this.ledger.run((tx) => this.close(tx, raffleId, seedRevealed));
  }

  private async close(
    tx: LedgerTransaction,
    raffleId: string,
    seedRevealed: string,
  ): Promise<Raffle> {
    // The raffle lock excludes approvals, so the list below is final.
    const raffle = (await tx.lockRaffle(raffleId)) as Raffle;
    const previousStatus = raffle.status;
    // Another run, or a cancel, got here first while the seed was revealed.
    if (previousStatus !== RaffleStatus.ACTIVE) {
      return raffle;
    }

    // Orders first, as every writer locks them before tickets.
    const inReview = await resolveUnsettledOrders(
      tx,
      raffle,
      this.clock.now(),
      REASON,
    );

    const soldTickets = await tx.lockSoldTickets(raffleId);
    const sortedSoldNumbers = normalizeSoldNumbers(
      soldTickets.map((t) => t.number),
    );
    const listHash = await soldListHash(sortedSoldNumbers);

    raffle.closeSales(listHash, seedRevealed);
    await tx.saveRaffle(raffle, previousStatus);
    // A close that got through after a failure closes its own alert.
    await tx.clearRaffleAlert(
      OperatorAlertType.CLOSE_BLOCKED,
      raffleId,
      SYSTEM_OPERATOR,
      this.clock.now(),
    );

    await tx.recordAudit({
      raffleId,
      type: 'SALES_CLOSED',
      data: {
        soldListHash: listHash,
        totalSold: sortedSoldNumbers.length,
        seedRevealed,
        ordersInReview: inReview.map((order) => order.id),
      },
    });

    return raffle;
  }
}
