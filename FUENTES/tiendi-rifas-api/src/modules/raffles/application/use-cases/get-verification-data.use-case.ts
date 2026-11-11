import { DrawExtraction, normalizeSoldNumbers, soldListHash } from '@kanoso/raffle-draw';
import { DrawNotPossibleError, RaffleNotFoundError } from '../../domain';
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
  /** The round fixed before sales opened, the only one a draw uses (DT-18). */
  drandRound: string;
  /** ISO 8601: publishing fixed the round as roundAt(drawAt) on the chain. */
  drawAt: string;
  /** ISO 8601: the round must come after the round of this instant (DT-18). */
  salesCloseAt: string;
  drandRandomness: string;
  soldListHash: string;
  /** False when the numbers below no longer hash to the published value. */
  soldListVerified: boolean;
  soldNumbers: number[];
  winnerIndex: number;
  winningNumber: number;
  digestHex: string;
  winningAttempt: number;
  extractions: DrawExtraction[];
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
      throw new RaffleNotFoundError(raffleId);
    }

    const draw = await this.drawRepo.findByRaffleId(raffleId);
    if (!draw) {
      throw new DrawNotPossibleError(`Raffle ${raffleId} has no draw yet`);
    }

    const soldTickets = await this.ticketRepo.findSoldByRaffleId(raffleId);
    const soldNumbers = normalizeSoldNumbers(soldTickets.map((t) => t.number));
    const soldListVerified =
      (await soldListHash(soldNumbers)) === raffle.soldListHash;

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
      drawAt: raffle.drawAt?.toISOString() ?? '',
      salesCloseAt: raffle.salesCloseAt?.toISOString() ?? '',
      drandRandomness: draw.drandRandomness,
      soldListHash: raffle.soldListHash ?? '',
      soldListVerified,
      soldNumbers,
      winnerIndex: draw.winnerIndex,
      winningNumber: draw.winningNumber,
      digestHex: draw.digestHex,
      winningAttempt: draw.winningAttempt,
      extractions: draw.extractions,
      executedAt: draw.executedAt.toISOString(),
    };
  }
}
