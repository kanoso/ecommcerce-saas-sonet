import { normalizeSoldNumbers, soldListHash } from '@kanoso/raffle-draw';
import { Raffle } from '../../domain';
import {
  AuditLog,
  RaffleRepository,
  SeedVault,
  TicketRepository,
} from '../ports';

export class CloseSalesUseCase {
  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly ticketRepo: TicketRepository,
    private readonly seedVault: SeedVault,
    private readonly auditLog: AuditLog,
  ) {}

  async execute(raffleId: string): Promise<Raffle> {
    const raffle = await this.raffleRepo.findById(raffleId);
    if (!raffle) {
      throw new Error(`Raffle ${raffleId} not found`);
    }

    if (!raffle.seedCiphertext) {
      throw new Error(`Seed ciphertext not found for raffle ${raffleId}`);
    }

    // 1. Freeze sold tickets list
    const soldTickets = await this.ticketRepo.findSoldByRaffleId(raffleId);
    const sortedSoldNumbers = normalizeSoldNumbers(
      soldTickets.map((t) => t.number),
    );
    const listHash = await soldListHash(sortedSoldNumbers);

    // 2. Reveal seed
    const seedRevealed = await this.seedVault.revealSeed(
      raffle.id,
      raffle.seedCiphertext,
    );

    // 3. Close sales on domain entity
    raffle.closeSales(listHash, seedRevealed);
    await this.raffleRepo.save(raffle);

    // 4. Audit
    await this.auditLog.record({
      raffleId,
      type: 'SALES_CLOSED',
      data: {
        soldListHash: listHash,
        totalSold: sortedSoldNumbers.length,
        seedRevealed,
      },
    });

    return raffle;
  }
}
