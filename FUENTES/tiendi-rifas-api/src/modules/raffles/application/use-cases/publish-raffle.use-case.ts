import { roundAt } from '@kanoso/raffle-draw';
import { Raffle, Ticket } from '../../domain';
import {
  AuditLog,
  Clock,
  RaffleRepository,
  RandomnessBeacon,
  SeedVault,
  TicketRepository,
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
    private readonly ticketRepo: TicketRepository,
    private readonly seedVault: SeedVault,
    private readonly beacon: RandomnessBeacon,
    private readonly auditLog: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(command: PublishRaffleCommand): Promise<Raffle> {
    const raffle = await this.raffleRepo.findById(command.raffleId);
    if (!raffle) {
      throw new Error(`Raffle ${command.raffleId} not found`);
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

    raffle.publish({
      authorizationResolution: command.authorizationResolution,
      commitmentHash,
      seedCiphertext,
      drandRound,
      drandChainHash: chainInfo.chainHash,
      salesCloseAt: command.salesCloseAt,
      drawAt: command.drawAt,
      currentRoundAtSalesClose,
    });

    await this.raffleRepo.save(raffle);

    // Pre-create tickets from numberMin to numberMax in AVAILABLE status
    const ticketsToCreate: Ticket[] = [];
    for (let num = raffle.numberMin; num <= raffle.numberMax; num++) {
      ticketsToCreate.push(
        new Ticket({
          id: `${raffle.id}-${num}`,
          raffleId: raffle.id,
          number: num,
          createdAt: this.clock.now(),
        }),
      );
    }
    await this.ticketRepo.createBatch(ticketsToCreate);

    await this.auditLog.record({
      raffleId: raffle.id,
      type: 'RAFFLE_PUBLISHED',
      data: {
        authorizationResolution: raffle.authorizationResolution,
        commitmentHash: raffle.commitmentHash,
        drandRound: raffle.drandRound?.toString(),
        drandChainHash: raffle.drandChainHash,
        salesCloseAt: raffle.salesCloseAt?.toISOString(),
        drawAt: raffle.drawAt?.toISOString(),
        totalTickets: ticketsToCreate.length,
      },
    });

    return raffle;
  }
}
