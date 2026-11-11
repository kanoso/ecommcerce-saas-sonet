import { randomUUID } from 'crypto';
import {
  ProofPolicy,
  RaffleNotActiveError,
  RaffleNotFoundError,
  RaffleStatus,
  ReservationPolicy,
  TicketOrder,
} from '../../domain';
import { Clock, RaffleRepository, ReservationStore } from '../ports';

export interface ReserveTicketsCommand {
  raffleId: string;
  userId: string;
  numbers: number[];
}

export class ReserveTicketsUseCase {
  private readonly policy: ReservationPolicy;

  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly reservationStore: ReservationStore,
    private readonly clock: Clock,
    private readonly proofPolicy: ProofPolicy,
    policy?: ReservationPolicy,
  ) {
    this.policy = policy ?? new ReservationPolicy();
  }

  async execute(command: ReserveTicketsCommand): Promise<TicketOrder> {
    const raffle = await this.raffleRepo.findById(command.raffleId);
    if (!raffle) {
      throw new RaffleNotFoundError(command.raffleId);
    }

    if (raffle.status !== RaffleStatus.ACTIVE) {
      throw new RaffleNotActiveError(raffle.id, raffle.status);
    }

    const numbers = [...new Set(command.numbers)].sort((a, b) => a - b);
    this.policy.validateReservationRequest(numbers.length, 0);

    const now = this.clock.now();

    const order = new TicketOrder({
      id: randomUUID(),
      raffleId: raffle.id,
      userId: command.userId,
      numbers,
      totalAmount: numbers.length * raffle.ticketPrice,
      createdAt: now,
      expiresAt: this.policy.calculateExpiration(now),
    });

    await this.reservationStore.reserve(
      order,
      {
        raffleId: raffle.id,
        type: 'TICKETS_RESERVED',
        data: {
          orderId: order.id,
          userId: order.userId,
          numbers: order.numbers,
          expiresAt: order.expiresAt.toISOString(),
        },
      },
      this.policy,
      // The store checks the cutoff under the raffle lock, so a stale read
      // here cannot let a reservation past it. The cutoff uses the TTL of
      // this.policy, the one that set expiresAt (DT-05).
      this.proofPolicy,
    );

    return order;
  }
}
