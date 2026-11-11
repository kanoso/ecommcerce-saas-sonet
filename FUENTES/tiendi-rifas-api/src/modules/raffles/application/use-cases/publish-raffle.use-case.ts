import { roundAt } from '@kanoso/raffle-draw';
import { Raffle, RaffleNotFoundError } from '../../domain';
import {
  RaffleRepository,
  RandomnessBeacon,
  SeedVault,
  TicketLedger,
} from '../ports';

export interface PublishRaffleCommand {
  raffleId: string;
  authorizationResolution: string;
  salesCloseAt: Date;
  drawAt: Date;
}

export class PublishRaffleUseCase {
  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly ledger: TicketLedger,
    private readonly seedVault: SeedVault,
    private readonly beacon: RandomnessBeacon,
  ) {}

  async execute(command: PublishRaffleCommand): Promise<Raffle> {
    const raffle = await this.raffleRepo.findById(command.raffleId);
    if (!raffle) {
      throw new RaffleNotFoundError(command.raffleId);
    }

    const chainInfo = await this.beacon.getChainInfo();
    const currentRoundAtSalesClose = BigInt(
      roundAt(command.salesCloseAt.getTime(), {
        genesisTimeSec: chainInfo.genesisTimeSec,
        periodSec: chainInfo.periodSec,
      }),
    );

    const drandRound = BigInt(
      roundAt(command.drawAt.getTime(), {
        genesisTimeSec: chainInfo.genesisTimeSec,
        periodSec: chainInfo.periodSec,
      }),
    );

    const { commitmentHash, seedCiphertext } =
      await this.seedVault.generateAndStoreSeed(raffle.id);

    return this.ledger.run(async (tx) => {
      const locked = await tx.lockRaffle(raffle.id);
      if (!locked) {
        throw new RaffleNotFoundError(raffle.id);
      }

      const previousStatus = locked.status;
      locked.publish({
        authorizationResolution: command.authorizationResolution,
        commitmentHash,
        seedCiphertext,
        drandRound,
        drandChainHash: chainInfo.chainHash,
        salesCloseAt: command.salesCloseAt,
        drawAt: command.drawAt,
        currentRoundAtSalesClose,
      });
      await tx.saveRaffle(locked, previousStatus);

      const totalTickets = await tx.createAvailableTickets(locked);

      await tx.recordAudit({
        raffleId: locked.id,
        type: 'RAFFLE_PUBLISHED',
        data: {
          authorizationResolution: locked.authorizationResolution,
          commitmentHash: locked.commitmentHash,
          drandRound: locked.drandRound?.toString(),
          drandChainHash: locked.drandChainHash,
          salesCloseAt: locked.salesCloseAt?.toISOString(),
          drawAt: locked.drawAt?.toISOString(),
          totalTickets,
        },
      });

      return locked;
    });
  }
}
