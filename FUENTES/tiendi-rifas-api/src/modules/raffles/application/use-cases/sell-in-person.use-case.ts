import { randomUUID } from 'crypto';
import {
  BankOrWallet,
  OrderStatus,
  Payment,
  RaffleNotFoundError,
  RaffleNotActiveError,
  RaffleStatus,
  RaffleValidationError,
  SalesClosedError,
  StaleStateError,
  TicketNotAvailableError,
  TicketOrder,
  TicketStatus,
  parseOperatorId,
} from '../../domain';
import { AuthStore } from '../../../auth/auth.store';
import {
  Clock,
  LedgerTransaction,
  RaffleRepository,
  TicketLedger,
} from '../ports';

export interface SellInPersonCommand {
  raffleId: string;
  operatorId: string;
  numbers: number[];
  alias: string;
  phone: string;
  document?: string | null;
}

export class SellInPersonUseCase {
  constructor(
    private readonly ledger: TicketLedger,
    private readonly authStore: AuthStore,
    private readonly clock: Clock,
    private readonly raffleRepo?: RaffleRepository,
  ) {}

  async execute(command: SellInPersonCommand): Promise<TicketOrder> {
    const operatorId = parseOperatorId(command.operatorId);

    const rawNumbers = command.numbers;
    if (!rawNumbers || rawNumbers.length === 0) {
      throw new RaffleValidationError('At least one ticket number must be provided');
    }
    const numbers = [...new Set(rawNumbers)].sort((a, b) => a - b);

    const cleanPhone = command.phone.trim();
    let buyer = await this.authStore.findUserByIdentifier(cleanPhone);
    if (!buyer && command.document) {
      buyer = await this.authStore.findUserByIdentifier(command.document.trim());
    }

    if (!buyer) {
      buyer = await this.authStore.createUser({
        name: command.alias.trim(),
        phone: cleanPhone,
        document: command.document?.trim() || null,
        role: 'buyer',
      });
    }

    const now = this.clock.now();

    const order = await this.ledger.run(async (tx: LedgerTransaction) => {
      const raffle = await tx.lockRaffle(command.raffleId);
      if (!raffle) {
        throw new RaffleNotFoundError(command.raffleId);
      }

      if (raffle.status !== RaffleStatus.ACTIVE) {
        throw new RaffleNotActiveError(raffle.id, raffle.status);
      }

      if (
        raffle.salesCloseAt &&
        now.getTime() >= raffle.salesCloseAt.getTime()
      ) {
        throw new SalesClosedError(raffle.id);
      }

      const tickets = await tx.lockTickets(raffle.id, numbers);
      const unavailable = numbers.filter((num) => {
        const t = tickets.find((ticket) => ticket.number === num);
        return !t || t.status !== TicketStatus.AVAILABLE;
      });

      if (unavailable.length > 0) {
        throw new TicketNotAvailableError(unavailable);
      }

      const totalAmount = numbers.length * raffle.ticketPrice;
      const orderId = randomUUID();

      const newOrder = new TicketOrder({
        id: orderId,
        raffleId: raffle.id,
        userId: buyer!.id,
        numbers,
        totalAmount,
        status: OrderStatus.PAID,
        bankOrWallet: BankOrWallet.EFECTIVO,
        declaredAmount: totalAmount,
        verifiedBy: operatorId,
        verifiedAt: now,
        createdAt: now,
        expiresAt: now,
      });

      await tx.createOrder(newOrder);

      const payment = new Payment({
        id: randomUUID(),
        orderId: newOrder.id,
        provider: BankOrWallet.EFECTIVO,
        externalId: `EFECTIVO-${newOrder.id}`,
        status: 'APPROVED',
        payload: {
          receivedAmount: totalAmount,
          declaredAmount: totalAmount,
          verifiedBy: operatorId,
          buyerAlias: command.alias.trim(),
          buyerPhone: cleanPhone,
          buyerDocument: command.document?.trim() || null,
        },
        receivedAt: now,
      });

      await tx.addPayment(payment);

      tickets.forEach((ticket) => ticket.sellDirect(newOrder.id));
      try {
        await tx.transitionTickets(tickets, {
          status: TicketStatus.AVAILABLE,
          orderId: null,
        });
      } catch (err) {
        if (err instanceof StaleStateError) {
          throw new TicketNotAvailableError(numbers);
        }
        throw err;
      }

      await tx.recordAudit({
        raffleId: raffle.id,
        type: 'IN_PERSON_SALE_COMPLETED',
        data: {
          orderId: newOrder.id,
          userId: buyer!.id,
          numbers: newOrder.numbers,
          totalAmount: newOrder.totalAmount,
          operatorId,
          verifiedAt: now.toISOString(),
          buyer: {
            name: command.alias.trim(),
            phone: cleanPhone,
            document: command.document?.trim() || null,
          },
        },
      });

      return newOrder;
    });

    return order;
  }
}
