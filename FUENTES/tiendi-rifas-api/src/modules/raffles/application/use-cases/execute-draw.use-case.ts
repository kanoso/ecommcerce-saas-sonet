import {
  ALGORITHM_VERSION,
  computeWinner,
  normalizeSoldNumbers,
  verifyCommitment,
} from '@kanoso/raffle-draw';
import { Draw, RaffleStatus } from '../../domain';
import {
  AuditLog,
  Clock,
  DrawRepository,
  Notifier,
  RaffleRepository,
  RandomnessBeacon,
  TicketRepository,
} from '../ports';

export class ExecuteDrawUseCase {
  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly ticketRepo: TicketRepository,
    private readonly drawRepo: DrawRepository,
    private readonly beacon: RandomnessBeacon,
    private readonly notifier: Notifier,
    private readonly auditLog: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(raffleId: string): Promise<Draw> {
    const raffle = await this.raffleRepo.findById(raffleId);
    if (!raffle) {
      throw new Error(`Raffle ${raffleId} not found`);
    }

    if (raffle.status !== RaffleStatus.CLOSED) {
      throw new Error(
        `Cannot execute draw: raffle must be in CLOSED status (current status: ${raffle.status})`,
      );
    }

    if (!raffle.seedRevealed || !raffle.commitmentHash || !raffle.drandRound) {
      throw new Error(`Missing draw parameters for raffle ${raffleId}`);
    }

    // Verify seed commitment
    const isSeedValid = await verifyCommitment(
      raffle.seedRevealed,
      raffle.commitmentHash,
    );
    if (!isSeedValid) {
      throw new Error('Seed does not match commitment hash');
    }

    // Get sold tickets
    const soldTickets = await this.ticketRepo.findSoldByRaffleId(raffleId);
    if (soldTickets.length === 0) {
      throw new Error('Cannot execute draw: no tickets were sold');
    }

    const soldNumbers = normalizeSoldNumbers(soldTickets.map((t) => t.number));

    // Get randomness from beacon
    const beaconRound = await this.beacon.getRound(raffle.drandRound);

    // Compute winner deterministically
    const result = await computeWinner({
      seedHex: raffle.seedRevealed,
      drandRandomnessHex: beaconRound.randomness,
      raffleId: raffle.id,
      soldNumbers,
    });

    const winningTicket = soldTickets.find((t) => t.number === result.winner);
    if (!winningTicket) {
      throw new Error(
        `Winning ticket number ${result.winner} not found among sold tickets`,
      );
    }

    const draw = new Draw({
      id: `draw_${Date.now()}`,
      raffleId: raffle.id,
      algorithmVersion: ALGORITHM_VERSION,
      seedRevealed: raffle.seedRevealed,
      drandRandomness: beaconRound.randomness,
      drandRound: raffle.drandRound,
      digestHex: result.digestHex,
      totalSold: soldNumbers.length,
      winningTicketId: winningTicket.id,
      winningNumber: result.winner,
      winnerIndex: result.index,
      executedAt: this.clock.now(),
    });

    await this.drawRepo.save(draw);

    // Update raffle state
    raffle.markDrawn();
    await this.raffleRepo.save(raffle);

    // Notify winner
    await this.notifier.sendWinnerNotification(winningTicket.orderId ?? raffle.id, {
      raffleId: raffle.id,
      raffleTitle: raffle.title,
      winningNumber: result.winner,
      prize: raffle.prize,
    });

    // Audit log
    await this.auditLog.record({
      raffleId: raffle.id,
      type: 'DRAW_EXECUTED',
      data: {
        winningNumber: result.winner,
        winnerIndex: result.index,
        drandRound: draw.drandRound.toString(),
        drandRandomness: draw.drandRandomness,
        digestHex: draw.digestHex,
        totalSold: draw.totalSold,
      },
    });

    return draw;
  }
}
