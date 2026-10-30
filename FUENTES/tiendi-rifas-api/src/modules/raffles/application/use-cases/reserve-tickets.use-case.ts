import {
  RaffleNotActiveError,
  RaffleStatus,
  ReservationPolicy,
  TicketNotAvailableError,
  TicketOrder,
  TicketStatus,
} from '../../domain';
import {
  AuditLog,
  Clock,
  OrderRepository,
  RaffleRepository,
  TicketRepository,
} from '../ports';

export interface ReserveTicketsCommand {
  raffleId: string;
  userId: string;
  numbers: number[];
}

export class ReserveTicketsUseCase {
  private readonly policy: ReservationPolicy;

  constructor(
    private readonly raffleRepo: RaffleRepository,
    private readonly ticketRepo: TicketRepository,
    private readonly orderRepo: OrderRepository,
    private readonly auditLog: AuditLog,
    private readonly clock: Clock,
    policy?: ReservationPolicy,
  ) {
    this.policy = policy ?? new ReservationPolicy();
  }

  async execute(command: ReserveTicketsCommand): Promise<TicketOrder> {
    const raffle = await this.raffleRepo.findById(command.raffleId);
    if (!raffle) {
      throw new Error(`Raffle ${command.raffleId} not found`);
    }

    if (raffle.status !== RaffleStatus.ACTIVE) {
      throw new RaffleNotActiveError(raffle.id, raffle.status);
    }

    const now = this.clock.now();

    // Check user limits
    const currentActiveReservedCount =
      await this.ticketRepo.countActiveReservedByUser(
        raffle.id,
        command.userId,
        now,
      );

    this.policy.validateReservationRequest(
      command.numbers.length,
      currentActiveReservedCount,
    );

    // Fetch requested tickets
    const tickets = await this.ticketRepo.findByRaffleAndNumbers(
      raffle.id,
      command.numbers,
    );

    if (tickets.length !== command.numbers.length) {
      const foundNumbers = new Set(tickets.map((t) => t.number));
      const missing = command.numbers.find((n) => !foundNumbers.has(n));
      throw new TicketNotAvailableError(missing ?? command.numbers[0]);
    }

    // Verify all are AVAILABLE (or expired reservation)
    for (const ticket of tickets) {
      if (ticket.status !== TicketStatus.AVAILABLE) {
        throw new TicketNotAvailableError(ticket.number);
      }
    }

    const expiresAt = this.policy.calculateExpiration(now);
    const orderId = `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const totalAmount = command.numbers.length * raffle.ticketPrice;

    // Reserve all tickets (all or nothing)
    for (const ticket of tickets) {
      ticket.reserve(orderId, expiresAt);
    }

    await this.ticketRepo.updateBatch(tickets);

    const order = new TicketOrder({
      id: orderId,
      raffleId: raffle.id,
      userId: command.userId,
      numbers: command.numbers,
      totalAmount,
      createdAt: now,
      expiresAt,
    });

    await this.orderRepo.save(order);

    await this.auditLog.record({
      raffleId: raffle.id,
      type: 'TICKETS_RESERVED',
      data: {
        orderId: order.id,
        userId: order.userId,
        numbers: order.numbers,
        expiresAt: order.expiresAt.toISOString(),
      },
    });

    return order;
  }
}
