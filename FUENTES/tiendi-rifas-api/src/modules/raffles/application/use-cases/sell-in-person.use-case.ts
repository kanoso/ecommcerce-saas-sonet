import { randomUUID } from 'crypto';
import {
  BankOrWallet,
  BuyerCodeConflictError,
  BuyerCodeNotFoundError,
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
  buyerCodeBaseOf,
  nextBuyerCode,
  normalizeBuyerCode,
  parseOperatorId,
} from '../../domain';
import { AuthStore, AuthUser, BuyerCodeTakenError } from '../../../auth/auth.store';
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
  phone?: string | null;
  document?: string | null;
  /** The code of a returning buyer; when given it wins over phone and document. */
  buyerCode?: string | null;
}

/** How the sale found an existing buyer; null when it created one. */
export type BuyerMatch = 'BUYER_CODE' | 'PHONE' | 'DOCUMENT';

export interface InPersonSaleBuyer {
  id: string;
  /** The stored name of the buyer, or the alias typed for this sale. */
  alias: string;
  /** Null for an existing buyer created before buyer codes, or online. */
  buyerCode: string | null;
  matchedBy: BuyerMatch | null;
}

export interface InPersonSaleResult {
  order: TicketOrder;
  buyer: InPersonSaleBuyer;
}

/** How many correlatives are tried when concurrent sales take them first. */
const MAX_BUYER_CODE_ATTEMPTS = 5;

function present(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

export class SellInPersonUseCase {
  constructor(
    private readonly ledger: TicketLedger,
    private readonly authStore: AuthStore,
    private readonly clock: Clock,
    private readonly raffleRepo?: RaffleRepository,
  ) {}

  async execute(command: SellInPersonCommand): Promise<InPersonSaleResult> {
    const operatorId = parseOperatorId(command.operatorId);

    const rawNumbers = command.numbers;
    if (!rawNumbers || rawNumbers.length === 0) {
      throw new RaffleValidationError('At least one ticket number must be provided');
    }
    const numbers = [...new Set(rawNumbers)].sort((a, b) => a - b);

    const alias = command.alias.trim();
    const phone = present(command.phone);
    const document = present(command.document);
    const { user: buyer, matchedBy } = await this.resolveBuyer(
      alias,
      phone,
      document,
      command.buyerCode,
    );
    const buyerCode = buyer.buyerCode ?? null;

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
        userId: buyer.id,
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
          buyerAlias: alias,
          buyerPhone: phone,
          buyerDocument: document,
          buyerCode,
          matchedBy,
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
          userId: buyer.id,
          numbers: newOrder.numbers,
          totalAmount: newOrder.totalAmount,
          operatorId,
          verifiedAt: now.toISOString(),
          matchedBy,
          buyer: {
            name: alias,
            phone,
            document,
            buyerCode,
          },
        },
      });

      return newOrder;
    });

    return {
      order,
      buyer: {
        id: buyer.id,
        alias: buyer.name?.trim() || alias,
        buyerCode,
        matchedBy,
      },
    };
  }

  /**
   * Buyer code first (exact, after normalizing), then phone, then document;
   * otherwise a new buyer named after the alias, with a new buyer code. A
   * matched buyer keeps its stored phone and document: what the operator
   * typed is kept in the payment and the audit, never written over it.
   * @throws BuyerCodeNotFoundError when a code is given and no buyer has it.
   */
  private async resolveBuyer(
    alias: string,
    phone: string | null,
    document: string | null,
    rawCode: string | null | undefined,
  ): Promise<{ user: AuthUser; matchedBy: BuyerMatch | null }> {
    const code = normalizeBuyerCode(rawCode ?? '');
    if (code) {
      const user = await this.authStore.findUserByBuyerCode(code);
      if (!user) {
        throw new BuyerCodeNotFoundError(code);
      }
      return { user, matchedBy: 'BUYER_CODE' };
    }
    if (phone) {
      const user = await this.authStore.findUserByIdentifier(phone);
      if (user) return { user, matchedBy: 'PHONE' };
    }
    if (document) {
      const user = await this.authStore.findUserByIdentifier(document);
      if (user) return { user, matchedBy: 'DOCUMENT' };
    }
    return { user: await this.createBuyer(alias, phone, document), matchedBy: null };
  }

  /**
   * The next free correlative of the alias' base. Two sales can compute the
   * same one: the UNIQUE index rejects the second, which tries again.
   */
  private async createBuyer(
    alias: string,
    phone: string | null,
    document: string | null,
  ): Promise<AuthUser> {
    const base = buyerCodeBaseOf(alias);
    for (let attempt = 1; attempt <= MAX_BUYER_CODE_ATTEMPTS; attempt++) {
      const taken = await this.authStore.findBuyerCodesWithBase(base);
      try {
        return await this.authStore.createUser({
          name: alias,
          phone,
          document,
          buyerCode: nextBuyerCode(base, taken),
          role: 'buyer',
        });
      } catch (err) {
        if (!(err instanceof BuyerCodeTakenError)) {
          throw err;
        }
      }
    }
    throw new BuyerCodeConflictError(base, MAX_BUYER_CODE_ATTEMPTS);
  }
}
