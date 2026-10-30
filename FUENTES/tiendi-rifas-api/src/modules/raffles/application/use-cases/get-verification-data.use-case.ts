import { normalizeSoldNumbers } from '@kanoso/raffle-draw';
import {
  DrawRepository,
  RaffleRepository,
  TicketRepository,
} from '../ports';

export interface VerificationDataResponse {
  raffleId: string;
  title: string;
  prize: string;
  algorithmVersion: string;
  authorizationResolution: string;
  status: string;
  commitmentHash: string;
  seedRevealed: string;
  drandChainHash: string;
  drandRound: string;
  drandRandomness: string;
  soldListHash: string;
  soldNumbers: number[];
  winnerIndex: number;
  winningNumber: number;
  digestHex: string;
  executedAt: string;
}

export class GetVerificationDataUseCase {
  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly ticketRepo: TicketRepository,
    private readonly drawRepo: DrawRepository,
  ) {}

  async execute(raffleId: string): Promise<VerificationDataResponse> {
    const raffle = await this.raffleRepo.findById(raffleId);
    if (!raffle) {
      throw new Error(`Raffle ${raffleId} not found`);
    }

    const draw = await this.drawRepo.findByRaffleId(raffleId);
    if (!draw) {
      throw new Error(`Draw data not found for raffle ${raffleId}`);
    }

    const soldTickets = await this.ticketRepo.findSoldByRaffleId(raffleId);
    const soldNumbers = normalizeSoldNumbers(soldTickets.map((t) => t.number));

    return {
      raffleId: raffle.id,
      title: raffle.title,
      prize: raffle.prize,
      algorithmVersion: draw.algorithmVersion,
      authorizationResolution: raffle.authorizationResolution ?? '',
      status: raffle.status,
      commitmentHash: raffle.commitmentHash ?? '',
      seedRevealed: draw.seedRevealed,
      drandChainHash: raffle.drandChainHash ?? '',
      drandRound: draw.drandRound.toString(),
      drandRandomness: draw.drandRandomness,
      soldListHash: raffle.soldListHash ?? '',
      soldNumbers,
      winnerIndex: draw.winnerIndex,
      winningNumber: draw.winningNumber,
      digestHex: draw.digestHex,
      executedAt: draw.executedAt.toISOString(),
    };
  }
}
