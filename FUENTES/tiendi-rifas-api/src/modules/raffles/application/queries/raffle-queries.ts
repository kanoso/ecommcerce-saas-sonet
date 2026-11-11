import { normalizeSoldNumbers } from '@kanoso/raffle-draw';
import {
  NotOrderOwnerError,
  OrderNotFoundError,
  OrderStatus,
  Raffle,
  RaffleNotFoundError,
  RaffleStatus,
  Ticket,
  TicketOrder,
  TicketStatus,
} from '../../domain';
import {
  DrawRepository,
  OrderRepository,
  RaffleRepository,
  TicketRepository,
  TicketStatusCounts,
  zeroTicketCounts,
} from '../ports';

export type PublicNumberStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'UNAVAILABLE';

const PUBLIC_STATUS: Record<TicketStatus, PublicNumberStatus> = {
  [TicketStatus.AVAILABLE]: 'AVAILABLE',
  [TicketStatus.RESERVED]: 'RESERVED',
  [TicketStatus.SOLD]: 'SOLD',
  [TicketStatus.REFUNDED]: 'UNAVAILABLE',
};

/** The seed and the frozen list are public only from the close of sales. */
const FROZEN: readonly RaffleStatus[] = [RaffleStatus.CLOSED, RaffleStatus.DRAWN];

/**
 * The public sales progress of a raffle. Only the ticket status counts:
 * - sold: SOLD, a number whose payment an operator approved.
 * - reserved: RESERVED, held by an order waiting for payment or for the
 *   check of its proof. Not offered to others, but not sold either.
 * - available: AVAILABLE, the only status a buyer can reserve.
 * A REFUNDED number is none of them: it is never offered again.
 */
function summaryOf(raffle: Raffle, counts: TicketStatusCounts) {
  return {
    id: raffle.id,
    title: raffle.title,
    prize: raffle.prize,
    ticketPrice: raffle.ticketPrice,
    numberMin: raffle.numberMin,
    numberMax: raffle.numberMax,
    winningAttempt: raffle.winningAttempt,
    drawEffect: raffle.drawEffect,
    drawMode: raffle.drawMode,
    drawDurationSec: raffle.drawDurationSec,
    drawSpeed: raffle.drawSpeed,
    prizeDescription: raffle.prizeDescription,
    prizeImages: raffle.prizeImages,
    status: raffle.status,
    salesCloseAt: raffle.salesCloseAt?.toISOString() ?? null,
    drawAt: raffle.drawAt?.toISOString() ?? null,
    authorizationResolution: raffle.authorizationResolution,
    ticketsSold: counts[TicketStatus.SOLD],
    ticketsReserved: counts[TicketStatus.RESERVED],
    ticketsAvailable: counts[TicketStatus.AVAILABLE],
  };
}

function countsOf(tickets: Ticket[]): TicketStatusCounts {
  const counts = zeroTicketCounts();
  for (const t of tickets) {
    counts[t.status] += 1;
  }
  return counts;
}

function orderView(order: TicketOrder) {
  return {
    id: order.id,
    raffleId: order.raffleId,
    status: order.status,
    numbers: order.numbers,
    totalAmount: order.totalAmount,
    expiresAt: order.expiresAt.toISOString(),
    verificationDueAt: order.verificationDueAt?.toISOString() ?? null,
    declaredAmount: order.declaredAmount,
    bankOrWallet: order.bankOrWallet,
    rejectionReason: order.rejectionReason,
    hasProof: order.proofUrl !== null,
    createdAt: order.createdAt.toISOString(),
    paidToAccount: order.paidToAccount,
  };
}

/**
 * The read side of the HTTP API. It returns plain views: no buyer data on
 * public routes, no seed before the close, no proof key ever.
 */
export class RaffleQueries {
  constructor(
    private readonly raffles: RaffleRepository,
    private readonly tickets: TicketRepository,
    private readonly orders: OrderRepository,
    private readonly draws: DrawRepository,
  ) {}

    async finishedRaffles() {
    const finished = await this.raffles.findByStatus([RaffleStatus.DRAWN, RaffleStatus.CLOSED]);
    if (finished.length === 0) return [];
    const counts = await this.tickets.countByStatus(finished.map((r) => r.id));
    return finished.map((r) => summaryOf(r, counts.get(r.id) ?? zeroTicketCounts()));
  }

  async availableTickets(raffleId: string): Promise<number[]> {
    const all = await this.tickets.findByRaffleId(raffleId);
    return all
      .filter((t) => t.status === TicketStatus.AVAILABLE)
      .map((t) => t.number)
      .sort((a, b) => a - b);
  }

  async activeRaffles() {
    const active = await this.raffles.findByStatus([RaffleStatus.ACTIVE]);
    if (active.length === 0) return [];
    const counts = await this.tickets.countByStatus(active.map((r) => r.id));
    return active.map((r) => summaryOf(r, counts.get(r.id) ?? zeroTicketCounts()));
  }

  /** All raffles in any state for operators (RF-10..15). */
  async allRaffles() {
    const all = await this.raffles.findAll();
    if (all.length === 0) return [];
    const counts = await this.tickets.countByStatus(all.map((r) => r.id));
    return all.map((r) => summaryOf(r, counts.get(r.id) ?? zeroTicketCounts()));
  }

  /** Raffle summary in any state for operators, including DRAFT. */
  async adminRaffleDetail(raffleId: string) {
    const raffle = await this.raffles.findById(raffleId);
    if (!raffle) {
      throw new RaffleNotFoundError(raffleId);
    }
    const counts = await this.tickets.countByStatus([raffleId]);
    return summaryOf(raffle, counts.get(raffleId) ?? zeroTicketCounts());
  }

  async raffleDetail(raffleId: string, paging: { page: number; pageSize: number }) {
    const raffle = await this.publicRaffle(raffleId);
    const all = (await this.tickets.findByRaffleId(raffleId)).sort(
      (a, b) => a.number - b.number,
    );
    const start = (paging.page - 1) * paging.pageSize;
    return {
      raffle: summaryOf(raffle, countsOf(all)),
      grid: {
        page: paging.page,
        pageSize: paging.pageSize,
        total: all.length,
        pages: Math.ceil(all.length / paging.pageSize),
        numbers: all.slice(start, start + paging.pageSize).map((t: Ticket) => ({
          number: t.number,
          status: PUBLIC_STATUS[t.status],
        })),
      },
    };
  }

  /** Only data frozen at the close, and the official result when it exists. */
  async liveData(raffleId: string) {
    const raffle = await this.publicRaffle(raffleId);
    const frozen = FROZEN.includes(raffle.status);
    const sold = frozen
      ? normalizeSoldNumbers(
          (await this.tickets.findSoldByRaffleId(raffleId)).map((t) => t.number),
        )
      : null;
    const draw =
      raffle.status === RaffleStatus.DRAWN
        ? await this.draws.findByRaffleId(raffleId)
        : null;
    const soldTicketBuyers: Record<number, string> = {};
    if (frozen) {
      const ordersWithBuyers = this.orders.findByRaffleIdWithBuyer
        ? await this.orders.findByRaffleIdWithBuyer(raffleId)
        : [];
      for (const { order, buyer } of ordersWithBuyers) {
        if (order.status === OrderStatus.PAID) {
          const label =
            buyer?.name?.trim() ||
            buyer?.email ||
            buyer?.document ||
            'Participante verificado';
          for (const num of order.numbers) {
            soldTicketBuyers[num] = label;
          }
        }
      }
    }
    return {
      raffleId: raffle.id,
      title: raffle.title,
      status: raffle.status,
      numberMin: raffle.numberMin,
      numberMax: raffle.numberMax,
      winningAttempt: raffle.winningAttempt,
      drawEffect: raffle.drawEffect,
      drawMode: raffle.drawMode,
      drawDurationSec: raffle.drawDurationSec,
      drawSpeed: raffle.drawSpeed,
      commitmentHash: raffle.commitmentHash,
      drandChainHash: raffle.drandChainHash,
      // The round fixed before sales opened, the only one the draw uses (DT-18).
      drandRound: raffle.drandRound?.toString() ?? null,
      salesCloseAt: raffle.salesCloseAt?.toISOString() ?? null,
      drawAt: raffle.drawAt?.toISOString() ?? null,
      soldListHash: frozen ? raffle.soldListHash : null,
      seedRevealed: frozen ? raffle.seedRevealed : null,
      soldNumbers: sold,
      soldTicketBuyers,
      result: draw
        ? {
            winningNumber: draw.winningNumber,
            winnerIndex: draw.winnerIndex,
            digestHex: draw.digestHex,
            drandRandomness: draw.drandRandomness,
            winningAttempt: draw.winningAttempt,
            extractions: draw.extractions,
            executedAt: draw.executedAt.toISOString(),
          }
        : null,
    };
  }

  async orderFor(orderId: string, userId: string) {
    const order = await this.orders.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }
    if (order.userId !== userId) {
      throw new NotOrderOwnerError(orderId);
    }
    return orderView(order);
  }

  async ticketsOf(userId: string) {
    const mine = await this.orders.findByUserId(userId);
    const titles = new Map<string, string>();
    const views: {
      orderId: string;
      raffleId: string;
      raffleTitle: string;
      numbers: number[];
      status: OrderStatus;
      totalAmount: number;
      /** End of the reservation, as orderView gives it: one read, no query per order. */
      expiresAt: string;
    }[] = [];
    for (const order of mine) {
      if (!titles.has(order.raffleId)) {
        titles.set(order.raffleId, (await this.raffles.findById(order.raffleId))?.title ?? '');
      }
      views.push({
        orderId: order.id,
        raffleId: order.raffleId,
        raffleTitle: titles.get(order.raffleId) as string,
        numbers: order.numbers,
        status: order.status,
        totalAmount: order.totalAmount,
        expiresAt: order.expiresAt.toISOString(),
      });
    }
    return views;
  }

  async salesReport(raffleId: string) {
    const raffle = await this.raffles.findById(raffleId);
    if (!raffle) {
      throw new RaffleNotFoundError(raffleId);
    }
    const all = await this.tickets.findByRaffleId(raffleId);
    const orders = await this.orders.findByRaffleId(raffleId);
    const ordersByStatus: Partial<Record<OrderStatus, number>> = {};
    let paidAmount = 0;
    for (const order of orders) {
      ordersByStatus[order.status] = (ordersByStatus[order.status] ?? 0) + 1;
      if (order.status === OrderStatus.PAID) {
        paidAmount += order.totalAmount;
      }
    }
    const count = (status: TicketStatus) => all.filter((t) => t.status === status).length;
    return {
      raffleId,
      title: raffle.title,
      status: raffle.status,
      ticketsSold: count(TicketStatus.SOLD),
      ticketsReserved: count(TicketStatus.RESERVED),
      ticketsAvailable: count(TicketStatus.AVAILABLE),
      paidAmount: Math.round(paidAmount * 100) / 100,
      ordersByStatus,
    };
  }

  /** Orders across all non-draft raffles waiting for proof verification (RF-16). */
  /** Orders of a raffle with buyer information for administration. */
  async ordersWithBuyers(raffleId: string) {
    const raffle = await this.raffles.findById(raffleId);
    if (!raffle) {
      throw new RaffleNotFoundError(raffleId);
    }
    const records = await this.orders.findByRaffleIdWithBuyer(raffleId);
    return records.map(({ order, buyer }) => ({
      orden_id: order.id,
      rifa_id: order.raffleId,
      estado: order.status,
      numeros: order.numbers,
      monto_total: order.totalAmount,
      monto_declarado: order.declaredAmount,
      banco_o_billetera: order.bankOrWallet,
      numero_operacion: order.operationNumber,
      tiene_comprobante: order.proofUrl !== null,
      creada_en: order.createdAt.toISOString(),
      verificada_en: order.verifiedAt?.toISOString() ?? null,
      comprador: buyer
        ? {
            id: buyer.id,
            nombre: buyer.name,
            documento: buyer.document,
            celular: buyer.phone,
            email: buyer.email,
            name: buyer.name,
            document: buyer.document,
            phone: buyer.phone,
          }
        : null,
    }));
  }

  async allPendingProofs() {
    const raffles = await this.raffles.findAll();
    const result: Awaited<ReturnType<RaffleQueries['pendingProofs']>> = [];
    for (const r of raffles) {
      if (r.status === RaffleStatus.DRAFT || r.status === RaffleStatus.CANCELLED) continue;
      const proofs = await this.pendingProofs(r.id);
      result.push(...proofs);
    }
    return result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  /** Orders of the raffle waiting for an operator to check their proof. */
  async pendingProofs(raffleId: string) {
    const raffle = await this.raffles.findById(raffleId);
    if (!raffle) {
      throw new RaffleNotFoundError(raffleId);
    }
    const records = this.orders.findByRaffleIdWithBuyer
      ? await this.orders.findByRaffleIdWithBuyer(raffleId)
      : (await this.orders.findByRaffleId(raffleId)).map((order) => ({ order, buyer: null }));
    return records
      .filter(({ order }) => order.status === OrderStatus.PENDING_VERIFICATION)
      .sort((a, b) => a.order.createdAt.getTime() - b.order.createdAt.getTime())
      .map(({ order, buyer }) => ({
        ...orderView(order),
        operationNumber: order.operationNumber,
        raffleTitle: raffle.title,
        buyer: buyer
          ? {
              id: buyer.id,
              name: buyer.name,
              document: buyer.document,
              phone: buyer.phone,
              email: buyer.email,
            }
          : null,
      }));
  }

  static orderView = orderView;

  private async publicRaffle(raffleId: string): Promise<Raffle> {
    const raffle = await this.raffles.findById(raffleId);
    if (!raffle || raffle.status === RaffleStatus.DRAFT) {
      throw new RaffleNotFoundError(raffleId);
    }
    return raffle;
  }
}
