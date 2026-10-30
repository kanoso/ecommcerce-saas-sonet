import { Raffle } from '../../domain';
import { AuditLog, Clock, RaffleRepository } from '../ports';

export interface CreateRaffleCommand {
  id: string;
  title: string;
  prize: string;
  ticketPrice: number;
  numberMin: number;
  numberMax: number;
}

export class CreateRaffleUseCase {
  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly auditLog: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(command: CreateRaffleCommand): Promise<Raffle> {
    const raffle = new Raffle({
      id: command.id,
      title: command.title,
      prize: command.prize,
      ticketPrice: command.ticketPrice,
      numberMin: command.numberMin,
      numberMax: command.numberMax,
      createdAt: this.clock.now(),
      updatedAt: this.clock.now(),
    });

    await this.raffleRepo.save(raffle);

    await this.auditLog.record({
      raffleId: raffle.id,
      type: 'RAFFLE_CREATED',
      data: {
        title: raffle.title,
        ticketPrice: raffle.ticketPrice,
        numberMin: raffle.numberMin,
        numberMax: raffle.numberMax,
      },
    });

    return raffle;
  }
}
