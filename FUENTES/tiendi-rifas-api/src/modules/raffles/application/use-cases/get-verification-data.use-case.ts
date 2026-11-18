import { DrawExtraction, normalizeSoldNumbers, soldListHash } from '@kanoso/raffle-draw';
import {
  DrawNotPossibleError,
  DrawWinnerStatus,
  RaffleNotFoundError,
  WinnerExclusionMode,
} from '../../domain';
import {
  DrawRepository,
  OrderRepository,
  RaffleRepository,
  TicketRepository,
} from '../ports';
import { buyerGroupsOf, drawConfigHashOf } from './draw-config';

export interface VerificationPrize {
  position: number;
  title: string;
  description: string | null;
  images: string[];
}

export interface VerificationWinner {
  position: number;
  prizeTitle: string;
  status: DrawWinnerStatus;
  winningNumber: number | null;
  winnerIndex: number | null;
  digestHex: string | null;
  poolSize: number;
  extractions: DrawExtraction[];
  excludedTickets: number[];
}

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
  /** Prize 1's result; null when prize 1 is VOID (v2 only). */
  winnerIndex: number | null;
  winningNumber: number | null;
  digestHex: string | null;
  winningAttempt: number;
  extractions: DrawExtraction[];
  executedAt: string;
  /** Ordered prizes. */
  prizes: VerificationPrize[];
  winnerExclusionMode: WinnerExclusionMode;
  /** v2: hash frozen at the close; empty for raffles closed before multi-prize draws. */
  drawConfigHash: string;
  /** False when the configuration below no longer hashes to drawConfigHash. */
  drawConfigVerified: boolean;
  /** BUYER mode: sold tickets grouped by buyer (no identities); empty otherwise. */
  buyerGroups: number[][];
  /** One per prize, ordered by position. */
  winners: VerificationWinner[];
}

export class GetVerificationDataUseCase {
  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly ticketRepo: TicketRepository,
    private readonly drawRepo: DrawRepository,
    private readonly orderRepo: OrderRepository,
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

    // Buyers matter only in BUYER mode: v1 and TICKET_ONLY read none.
    const buyerMode = raffle.winnerExclusionMode === WinnerExclusionMode.BUYER;
    const groups = buyerMode
      ? buyerGroupsOf(
          soldTickets,
          new Map(
            (await this.orderRepo.findByRaffleId(raffleId)).map((o) => [o.id, o.userId]),
          ),
        )
      : [];
    const drawConfigVerified =
      raffle.drawConfigHash !== null &&
      (await drawConfigHashOf(raffle, groups)) === raffle.drawConfigHash;
    const prizes = raffle.prizes;

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
      prizes: prizes.map((p) => ({
        position: p.position,
        title: p.title,
        description: p.description,
        images: p.images,
      })),
      winnerExclusionMode: raffle.winnerExclusionMode,
      drawConfigHash: raffle.drawConfigHash ?? '',
      drawConfigVerified,
      buyerGroups: groups,
      winners: draw.winners.map((w) => ({
        position: w.position,
        prizeTitle: prizes[w.position - 1]?.title ?? '',
        status: w.status,
        winningNumber: w.winningNumber,
        winnerIndex: w.winnerIndex,
        digestHex: w.digestHex,
        poolSize: w.poolSize,
        extractions: w.extractions,
        excludedTickets: w.excludedTickets,
      })),
    };
  }
}
