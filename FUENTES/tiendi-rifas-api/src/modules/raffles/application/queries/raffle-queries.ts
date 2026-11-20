import { normalizeSoldNumbers } from '@kanoso/raffle-draw';
import {
  Draw,
  DrawExecutorKind,
  LiveDrawSession,
  NotOrderOwnerError,
  OrderNotFoundError,
  OrderStatus,
  Raffle,
  RaffleNotFoundError,
  RaffleStatus,
  Ticket,
  TicketOrder,
  TicketStatus,
  WinnerExclusionMode,
  isOperatorId,
  liveDrawPrizesOf,
  revealedPrizeCount,
} from '../../domain';
import { buyerGroupsOf } from '../use-cases/draw-config';
import { latestConfigRefusal } from '../use-cases/draw-refusals';
import {
  AuditLog,
  DrawRepository,
  LiveDrawSessionRepository,
  OperatorDirectory,
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
/** One prize's public result on a list or a detail: no buyer, no proof. */
export interface PrizeWinnerView {
  position: number;
  prizeTitle: string;
  status: string;
  winningNumber: number | null;
}

/** What a live draw session (DT-23) adds to a raffle's views. */
interface DrawState {
  /** A live session started and not finished: winners stay hidden meanwhile. */
  liveDrawInProgress: boolean;
  /** DRAWN raffles only, and only once no live session is in progress. */
  winners: PrizeWinnerView[];
}

const NO_DRAW_STATE: DrawState = { liveDrawInProgress: false, winners: [] };

function prizeTitleOf(raffle: Raffle, position: number): string {
  return raffle.prizes.find((p) => p.position === position)?.title ?? raffle.prize;
}

function winnersOf(raffle: Raffle, draw: Draw | null): PrizeWinnerView[] {
  if (!draw) return [];
  return draw.winners.map((w) => ({
    position: w.position,
    prizeTitle: prizeTitleOf(raffle, w.position),
    status: w.status,
    winningNumber: w.winningNumber,
  }));
}

/** Shown when an operator's account has no name (or is not found). */
export const FALLBACK_OPERATOR_NAME = 'Administrador';

type OperatorNames = Map<string, string | null>;

/** The account display name exactly as stored; the fallback when it is blank. */
function operatorName(names: OperatorNames, operatorId: string): string {
  const name = names.get(operatorId);
  return name && name.trim() !== '' ? name : FALLBACK_OPERATOR_NAME;
}

/** Who ran a draw, as the read side shows it: a kind and a display name, never an id. */
export interface DrawExecutorView {
  kind: DrawExecutorKind;
  name: string | null;
}

/** Who conducted a live session: the account display name, nothing else. */
export interface LiveDrawConductorView {
  name: string;
}

/** The dependencies of the read side. All are required: a missing one would hide data silently. */
export interface RaffleQueriesDeps {
  raffles: RaffleRepository;
  tickets: TicketRepository;
  orders: OrderRepository;
  draws: DrawRepository;
  auditLog: AuditLog;
  /** Live draw sessions (DT-23). */
  liveSessions: LiveDrawSessionRepository;
  /** Operator display names (DT-24). */
  operators: OperatorDirectory;
  /** Nest's Logger fits this shape. */
  log: { warn(message: string): void };
}

/**
 * Who ran the official draw: an operator by name, or the system (the draw
 * job). Never the operator's id. A draw recorded before the executor was
 * kept names nobody (null): it may well have been run live by an admin.
 */
function executedByView(draw: Draw, names: OperatorNames): DrawExecutorView | null {
  if (draw.executedByKind === 'ADMIN' && draw.executedBy) {
    return { kind: 'ADMIN', name: operatorName(names, draw.executedBy) };
  }
  if (draw.executedByKind === 'SYSTEM') {
    return { kind: 'SYSTEM', name: null };
  }
  return null;
}

/**
 * conductorId: who started the session, from startedBy or, for a legacy
 * session, from the audit log; null when unknown.
 */
function sessionView(
  session: LiveDrawSession | null,
  names: OperatorNames,
  conductorId: string | null,
) {
  const conductor = (operatorId: string): LiveDrawConductorView => ({
    name: operatorName(names, operatorId),
  });
  return session
    ? {
        step: session.step,
        totalSteps: session.totalSteps,
        startedAt: session.startedAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        finishedAt: session.finishedAt?.toISOString() ?? null,
        conductedBy: conductorId ? conductor(conductorId) : null,
      }
    : null;
}

/**
 * While a live session is in progress only the prizes whose every step was
 * revealed are shown (DT-23). The seed and the drand round are public, so a
 * technical viewer can compute the rest: this paces the show, it hides no
 * secret.
 */
function revealedWinners(draw: Draw, session: LiveDrawSession | null) {
  if (!session?.inProgress) {
    return draw.winners;
  }
  const count = revealedPrizeCount(liveDrawPrizesOf(draw), session.step);
  return draw.winners.filter((w) => w.position <= count);
}

/** The official result of the live data, paced by its session (DT-23). */
function resultView(draw: Draw, session: LiveDrawSession | null, names: OperatorNames) {
  const winners = revealedWinners(draw, session);
  // Prize 1's legacy columns follow prize 1's reveal.
  const firstShown = !session?.inProgress || winners.some((w) => w.position === 1);
  return {
    winningNumber: firstShown ? draw.winningNumber : null,
    winnerIndex: firstShown ? draw.winnerIndex : null,
    digestHex: firstShown ? draw.digestHex : null,
    drandRandomness: draw.drandRandomness,
    winningAttempt: draw.winningAttempt,
    extractions: firstShown ? draw.extractions : [],
    executedAt: draw.executedAt.toISOString(),
    algorithmVersion: draw.algorithmVersion,
    executedBy: executedByView(draw, names),
    winners,
  };
}

function summaryOf(raffle: Raffle, counts: TicketStatusCounts, state: DrawState = NO_DRAW_STATE) {
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
    prizes: raffle.prizes,
    winnerExclusionMode: raffle.winnerExclusionMode,
    status: raffle.status,
    salesCloseAt: raffle.salesCloseAt?.toISOString() ?? null,
    drawAt: raffle.drawAt?.toISOString() ?? null,
    authorizationResolution: raffle.authorizationResolution,
    ticketsSold: counts[TicketStatus.SOLD],
    ticketsReserved: counts[TicketStatus.RESERVED],
    ticketsAvailable: counts[TicketStatus.AVAILABLE],
    liveDrawInProgress: state.liveDrawInProgress,
    winners: state.winners,
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
  private readonly raffles: RaffleRepository;
  private readonly tickets: TicketRepository;
  private readonly orders: OrderRepository;
  private readonly draws: DrawRepository;
  private readonly auditLog: AuditLog;
  private readonly liveSessions: LiveDrawSessionRepository;
  private readonly operators: OperatorDirectory;
  private readonly log: RaffleQueriesDeps['log'];

  constructor(deps: RaffleQueriesDeps) {
    this.raffles = deps.raffles;
    this.tickets = deps.tickets;
    this.orders = deps.orders;
    this.draws = deps.draws;
    this.auditLog = deps.auditLog;
    this.liveSessions = deps.liveSessions;
    this.operators = deps.operators;
    this.log = deps.log;
  }

  /**
   * The names of the operators named by a session and a draw, in one read.
   * A failed lookup must not take the page down: every name falls back to
   * FALLBACK_OPERATOR_NAME and a warning is logged (no ids in it).
   */
  private async operatorNamesOf(
    conductorId: string | null,
    draw: Draw | null,
  ): Promise<OperatorNames> {
    const ids = [
      ...new Set([conductorId, draw?.executedBy].filter((id): id is string => !!id)),
    ];
    if (ids.length === 0) return new Map();
    try {
      return await this.operators.displayNamesOf(ids);
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'unknown error';
      this.log.warn(
        `Operator name lookup failed (${reason}); showing ${FALLBACK_OPERATOR_NAME} instead`,
      );
      return new Map();
    }
  }

  /**
   * Who started a live session. Sessions stored before startedBy was kept
   * take it from their earliest LIVE_DRAW_STARTED audit event: the audit log
   * is read only for those (the public page polls every second). A failed
   * read degrades to unknown, with a warning without ids. The executor of a
   * legacy draw is never taken from the audit: DRAW_EXECUTED has no operator.
   */
  private async conductorIdOf(session: LiveDrawSession | null): Promise<string | null> {
    if (!session) return null;
    if (session.startedBy) return session.startedBy;
    try {
      const started = await this.auditLog.firstOfType(session.raffleId, 'LIVE_DRAW_STARTED');
      const operatorId = started?.data.operatorId;
      return isOperatorId(operatorId) ? operatorId : null;
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'unknown error';
      this.log.warn(`Live draw conductor lookup in the audit log failed (${reason}); showing none`);
      return null;
    }
  }

  /** Who ran a draw, by name (DT-24): for the response of the draw itself. */
  async drawExecutorOf(draw: Draw): Promise<DrawExecutorView | null> {
    return executedByView(draw, await this.operatorNamesOf(null, draw));
  }

  /**
   * Raffles drawn (with no live session in progress) and cancelled ones,
   * once published. A CLOSED raffle waits for its draw: pendingDrawRaffles.
   */
  async finishedRaffles() {
    const candidates = await this.raffles.findByStatus([RaffleStatus.DRAWN, RaffleStatus.CANCELLED]);
    const published = candidates.filter(
      (r) => r.status === RaffleStatus.DRAWN || r.salesCloseAt !== null,
    );
    const summaries = await this.summariesOf(published);
    return summaries.filter((s) => !s.liveDrawInProgress);
  }

  /**
   * Raffles whose sales closed and whose result is not shown yet: CLOSED
   * ones, and DRAWN ones with a live session in progress, those first. Then
   * the most recently created first, like the other raffle lists.
   */
  async pendingDrawRaffles() {
    const candidates = await this.raffles.findByStatus([RaffleStatus.CLOSED, RaffleStatus.DRAWN]);
    const createdAt = new Map(candidates.map((r) => [r.id, r.createdAt.getTime()]));
    const summaries = await this.summariesOf(candidates);
    return summaries
      .filter((s) => s.status === RaffleStatus.CLOSED || s.liveDrawInProgress)
      .sort(
        (a, b) =>
          Number(b.liveDrawInProgress) - Number(a.liveDrawInProgress) ||
          (createdAt.get(b.id) ?? 0) - (createdAt.get(a.id) ?? 0),
      );
  }

  /** Summaries with their counts in one aggregate read, and their draw state. */
  private async summariesOf(list: Raffle[]) {
    if (list.length === 0) return [];
    const counts = await this.tickets.countByStatus(list.map((r) => r.id));
    const states = await this.drawStatesOf(list);
    return list.map((r) =>
      summaryOf(r, counts.get(r.id) ?? zeroTicketCounts(), states.get(r.id)),
    );
  }

  private async sessionsOf(list: Raffle[]): Promise<Map<string, LiveDrawSession>> {
    const ids = list
      .filter((r) => r.status === RaffleStatus.CLOSED || r.status === RaffleStatus.DRAWN)
      .map((r) => r.id);
    if (ids.length === 0) return new Map();
    const sessions = await this.liveSessions.findByRaffleIds(ids);
    return new Map(sessions.map((s) => [s.raffleId, s]));
  }

  private async drawStatesOf(list: Raffle[]): Promise<Map<string, DrawState>> {
    const sessions = await this.sessionsOf(list);
    const states = new Map<string, DrawState>();
    for (const raffle of list) {
      const liveDrawInProgress = sessions.get(raffle.id)?.inProgress ?? false;
      const winners =
        raffle.status === RaffleStatus.DRAWN && !liveDrawInProgress
          ? winnersOf(raffle, await this.draws.findByRaffleId(raffle.id))
          : [];
      states.set(raffle.id, { liveDrawInProgress, winners });
    }
    return states;
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

  /**
   * All raffles in any state for operators (RF-10..15), each CLOSED one with
   * its configuration refusal (DT-21) for the visible status (DT-23).
   */
  async allRaffles() {
    const all = await this.raffles.findAll();
    const summaries = await this.summariesOf(all);
    const refusals = new Map<string, Awaited<ReturnType<RaffleQueries['refusedDrawOf']>>>();
    for (const raffle of all) {
      refusals.set(raffle.id, await this.refusedDrawOf(raffle));
    }
    return summaries.map((s) => ({ ...s, refusedDraw: refusals.get(s.id) ?? null }));
  }

  /** Raffle summary in any state for operators, including DRAFT. */
  async adminRaffleDetail(raffleId: string) {
    const raffle = await this.raffles.findById(raffleId);
    if (!raffle) {
      throw new RaffleNotFoundError(raffleId);
    }
    const counts = await this.tickets.countByStatus([raffleId]);
    const session = (await this.sessionsOf([raffle])).get(raffle.id) ?? null;
    const draw =
      raffle.status === RaffleStatus.DRAWN ? await this.draws.findByRaffleId(raffleId) : null;
    const liveDrawInProgress = session?.inProgress ?? false;
    const conductorId = await this.conductorIdOf(session);
    const names = await this.operatorNamesOf(conductorId, draw);
    return {
      ...summaryOf(raffle, counts.get(raffleId) ?? zeroTicketCounts(), {
        liveDrawInProgress,
        winners: liveDrawInProgress ? [] : winnersOf(raffle, draw),
      }),
      refusedDraw: await this.refusedDrawOf(raffle),
      liveSession: sessionView(session, names, conductorId),
      drawExecutedBy: draw ? executedByView(draw, names) : null,
      // The operator sees every result at once, even during the live show.
      adminWinners: await this.adminWinnersOf(raffle, draw),
    };
  }

  /** Each prize's winner with the alias of the buyer who paid for the ticket. */
  private async adminWinnersOf(raffle: Raffle, draw: Draw | null) {
    const winners = winnersOf(raffle, draw);
    if (winners.length === 0) return [];
    const aliases = new Map<number, string>();
    for (const { order, buyer } of await this.orders.findByRaffleIdWithBuyer(raffle.id)) {
      const alias = buyer?.name?.trim() || buyer?.buyerCode || buyer?.email || null;
      if (order.status === OrderStatus.PAID && alias) {
        order.numbers.forEach((n) => aliases.set(n, alias));
      }
    }
    return winners.map((w) => ({
      ...w,
      buyerAlias: w.winningNumber === null ? null : aliases.get(w.winningNumber) ?? null,
    }));
  }

  /**
   * A CLOSED raffle whose draw was refused for its configuration: the
   * operator can only cancel it with a full refund (DT-21).
   */
  private async refusedDrawOf(raffle: Raffle) {
    if (raffle.status !== RaffleStatus.CLOSED) {
      return null;
    }
    const refusal = latestConfigRefusal(await this.auditLog.findByRaffleId(raffle.id));
    return refusal
      ? { reason: refusal.reason, at: refusal.occurredAt.toISOString() }
      : null;
  }

  async raffleDetail(raffleId: string, paging: { page: number; pageSize: number }) {
    const raffle = await this.publicRaffle(raffleId);
    const all = (await this.tickets.findByRaffleId(raffleId)).sort(
      (a, b) => a.number - b.number,
    );
    const start = (paging.page - 1) * paging.pageSize;
    const states = await this.drawStatesOf([raffle]);
    return {
      raffle: summaryOf(raffle, countsOf(all), states.get(raffle.id)),
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
    const session = (await this.sessionsOf([raffle])).get(raffle.id) ?? null;
    const conductorId = await this.conductorIdOf(session);
    const names = await this.operatorNamesOf(conductorId, draw);
    const soldTicketBuyers: Record<number, string> = {};
    let buyerGroups: number[][] = [];
    if (frozen) {
      const ordersWithBuyers = await this.orders.findByRaffleIdWithBuyer(raffleId);
      // BUYER mode: the grouping frozen in drawConfigHash, without identities.
      if (raffle.winnerExclusionMode === WinnerExclusionMode.BUYER) {
        const soldTickets = await this.tickets.findSoldByRaffleId(raffleId);
        buyerGroups = buyerGroupsOf(
          soldTickets,
          new Map(ordersWithBuyers.map(({ order }) => [order.id, order.userId])),
        );
      }
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
      prizes: raffle.prizes,
      winnerExclusionMode: raffle.winnerExclusionMode,
      // Frozen at the close with the sold list; null before.
      drawConfigHash: frozen ? raffle.drawConfigHash : null,
      buyerGroups,
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
      liveSession: sessionView(session, names, conductorId),
      result: draw ? resultView(draw, session, names) : null,
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
            codigo_comprador: buyer.buyerCode ?? null,
            name: buyer.name,
            document: buyer.document,
            phone: buyer.phone,
            buyerCode: buyer.buyerCode ?? null,
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
              buyerCode: buyer.buyerCode ?? null,
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
