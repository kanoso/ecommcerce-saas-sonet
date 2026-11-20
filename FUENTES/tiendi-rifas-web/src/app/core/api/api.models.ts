/** camelCase view models the app works with. Built only by api.mappers.ts. */

export type DrawEffect = 'SLOT_MACHINE' | 'TOMBOLA' | 'SUSPENSE_CONFETTI' | 'SNAKE' | 'RADAR';
export type DrawMode = 'AUTOMATIC' | 'MANUAL';
export type DrawSpeed = 'SLOW' | 'NORMAL' | 'FAST';

export interface DrawExtraction {
  attempt: number;
  number: number;
  index: number;
  digestHex: string;
  winningAttempt?: number;
  extractions?: DrawExtraction[];
  isWinner: boolean;
}

/** Which tickets leave the pool after a prize is won (multi-prize draws). */
export type WinnerExclusionMode = 'TICKET_ONLY' | 'BUYER';

/** One prize of a raffle; position 1 is drawn first. */
export interface RafflePrize {
  position: number;
  title: string;
  description: string | null;
  images: string[];
}

/** WON with its ticket, or VOID ("desierto") when the pool ran short. */
export type DrawWinnerStatus = 'WON' | 'VOID';

/** The official result of one prize. */
export interface DrawWinner {
  position: number;
  /** Only the verification data names it. */
  prizeTitle?: string;
  status: DrawWinnerStatus;
  winningNumber: number | null;
  winnerIndex: number | null;
  digestHex: string | null;
  /** Tickets in the pool before this prize was drawn. */
  poolSize: number;
  /** Tickets that left the pool after this prize. */
  excludedTickets: number[];
  extractions: DrawExtraction[];
}

export interface RaffleSummary {
  id: string;
  title: string;
  prize: string;
  ticketPrice: number;
  /** First and last number of the raffle; the range need not start at one. */
  numberMin: number;
  numberMax: number;
  totalNumbers: number;
  drawMode?: DrawMode;
  drawDurationSec?: number;
  drawSpeed?: DrawSpeed;
  winningAttempt?: number;
  drawEffect?: DrawEffect;
  prizeDescription?: string | null;
  prizeImages?: string[];
  /** Ordered prizes; at least the legacy single prize. */
  prizes: RafflePrize[];
  winnerExclusionMode: WinnerExclusionMode;
  status: string;
  salesCloseAt: Date | null;
  drawAt: Date | null;
  /** Sold numbers; null when the API does not report it. */
  soldCount: number | null;
  /** Numbers a buyer can still reserve; null when the API does not report it. */
  availableCount: number | null;
  /** Null when the API does not report it or it is blank. */
  authorizationResolution: string | null;
  /**
   * Admin detail only (DT-21): the draw was refused for its configuration and
   * the raffle can only be cancelled with a full refund. Null when it was not;
   * absent on routes that do not report it.
   */
  refusedDraw?: RefusedDraw | null;
  /** DT-23: a live draw session is in progress; winners stay hidden meanwhile. */
  liveDrawInProgress: boolean;
  /** DRAWN raffles: each prize's result; empty otherwise. */
  winners: PrizeWinnerSummary[];
  /** Admin detail only (DT-23): absent on routes that do not report it. */
  liveSession?: LiveDrawSession | null;
  /** Admin detail only: who ran the draw; null before it, absent when not reported. */
  executedBy?: DrawExecutor | null;
}

/** Who ran a draw: an admin (by name) or the scheduled system job. */
export interface DrawExecutor {
  kind: 'ADMIN' | 'SYSTEM';
  /** Null for the system, or an admin the API did not name. */
  name: string | null;
}

/** One prize's result on a list or a detail. */
export interface PrizeWinnerSummary {
  position: number;
  prizeTitle: string;
  status: DrawWinnerStatus;
  winningNumber: number | null;
  /** Admin detail only. */
  buyerAlias?: string | null;
}

/**
 * The server-paced reveal of a MANUAL draw (DT-23). step of totalSteps are
 * shown; finishedAt set means everything is shown for good.
 */
export interface LiveDrawSession {
  step: number;
  totalSteps: number;
  startedAt: Date | null;
  updatedAt: Date | null;
  finishedAt: Date | null;
  /** The operator's name; null for legacy sessions, absent when the API does not report it. */
  conductedBy?: string | null;
}

export interface RefusedDraw {
  /** DRAW_CONFIG_FROZEN_LATE, DRAW_CONFIG_MISMATCH or DRAW_CONFIG_MISSING. */
  reason: string;
  at: Date | null;
}

/** Public status of a number. Anything unknown is shown as UNAVAILABLE. */
export type NumberStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'UNAVAILABLE';

export interface GridNumber {
  number: number;
  status: NumberStatus;
}

/** One page of the grid, as the API pages it. */
export interface GridPage {
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  numbers: GridNumber[];
}

export interface RaffleDetail {
  raffle: RaffleSummary;
  grid: GridPage;
}

/** What the raffle committed to before sales opened (D1, DT-18). */
export interface Commitment {
  commitmentHash: string | null;
  drandRound: string | null;
}

/** The public live data of a raffle (spec §11 GET /api/rifas/:id/en-vivo). */
export interface LiveRaffleData {
  raffleId: string;
  title: string;
  status: string;
  commitmentHash: string | null;
  drandChainHash: string | null;
  drawMode?: DrawMode;
  drawDurationSec?: number;
  drawSpeed?: DrawSpeed;
  numberMin?: number;
  numberMax?: number;
  winningAttempt?: number;
  drawEffect?: DrawEffect;
  prizeDescription?: string | null;
  prizeImages?: string[];
  drandRound: string | null;
  salesCloseAt: Date | null;
  drawAt: Date | null;
  soldListHash: string | null;
  seedRevealed: string | null;
  soldNumbers: number[] | null;
  result: OfficialResult | null;
  soldTicketBuyers?: Record<number, string>;
  /** Ordered prizes; at least the legacy single prize. */
  prizes: RafflePrize[];
  winnerExclusionMode: WinnerExclusionMode;
  /** Frozen at the close; null before or for older raffles. */
  drawConfigHash: string | null;
  /** BUYER mode, from the close: sold tickets grouped by buyer, without identities. */
  buyerGroups?: number[][];
  /** DT-23: the live draw session of a MANUAL raffle; null when none. */
  liveSession: LiveDrawSession | null;
}

/** The public status and title of a raffle, read from its live data. */
export interface RaffleStatusInfo {
  title: string;
  status: string;
}

/** What the platform recorded when it ran the draw. */
export interface OfficialResult {
  drandRandomness: string;
  /** Prize 1's result; null only when prize 1 of a v2 draw was VOID. */
  winnerIndex: number | null;
  winningNumber: number | null;
  digestHex: string | null;
  winningAttempt?: number;
  extractions?: DrawExtraction[];
  executedAt: Date | null;
  /** 'v1' single prize, 'v2' multi-prize. */
  algorithmVersion?: string;
  /** One per prize, in order; empty when the API does not report them. */
  winners?: DrawWinner[];
  /** Who ran the draw; absent when the API does not report it. */
  executedBy?: DrawExecutor | null;
}

/** The frozen data of a drawn raffle, for anyone to recompute (RF-20). */
export interface VerificationData {
  raffleId: string;
  title: string;
  prize: string;
  algorithmVersion: string;
  authorizationResolution: string | null;
  status: string;
  commitmentHash: string;
  seedRevealed: string;
  drandChainHash: string;
  /** Decimal string, as the API sends it. */
  drandRound: string;
  /** The draw date the round was derived from at publish; null if unknown. */
  drawAt: Date | null;
  /** The close of sales; the round must come after its round. Null if unknown. */
  salesCloseAt: Date | null;
  soldListHash: string;
  /** Only an explicit `true` from the API counts (DT-11). */
  soldListVerified: boolean;
  soldNumbers: number[];
  winningAttempt?: number;
  drawEffect?: DrawEffect;
  prizeDescription?: string | null;
  prizeImages?: string[];
  extractions?: DrawExtraction[];
  official: OfficialResult;
  /** Ordered prizes; at least the legacy single prize. */
  prizes: RafflePrize[];
  winnerExclusionMode: WinnerExclusionMode;
  /** v2: the configuration hash frozen at the close; empty otherwise. */
  drawConfigHash: string;
  /** Only an explicit `true` from the API counts. */
  drawConfigVerified: boolean;
  /** BUYER mode: sold tickets grouped by buyer, without identities. */
  buyerGroups: number[][];
  /** One per prize, in order. */
  winners: DrawWinner[];
}

/** `BankOrWallet` of the API domain; the proof upload rejects any other value. */
export type BankOrWallet = 'YAPE' | 'PLIN' | 'BCP' | 'BBVA' | 'INTERBANK' | 'EFECTIVO';

/** An operator account the buyer transfers to (DT-19), from `GET /cuentas-pago`. */
export interface PaymentAccount {
  id: string;
  method: string;
  /** Name shown to the buyer, such as "Yape" or "BCP". */
  label: string;
  holder: string;
  /** Mobile for a wallet, account number for a bank: digits only. */
  number: string;
  /** Interbank code of a bank account; null for a wallet. */
  cci: string | null;
  /** The version the proof names back as `cuenta_version` (DT-19). */
  version: number;
}

export interface Order {
  id: string;
  raffleId: string;
  status: string;
  numbers: number[];
  totalAmount: number;
  /** End of the reservation per the server clock; null if unreadable. */
  expiresAt: Date | null;
  /** Review deadline of the operator once a proof was sent (DT-06). */
  verificationDueAt: Date | null;
  /** Soles the buyer declared paying; null before the proof. */
  declaredAmount: number | null;
  bankOrWallet: string | null;
  /** Shown to the buyer on REJECTED and REFUND_PENDING. */
  rejectionReason: string | null;
  hasProof: boolean;
  /** The operator account the buyer declared paying to (DT-19); null before the proof. */
  paidToAccount?: PaymentAccount | null;
}

/** An order of the session user, as "Mis boletos" lists it (RF-06). */
export interface MyTicket {
  orderId: string;
  raffleId: string;
  raffleTitle: string;
  numbers: number[];
  status: string;
  /** Decimal soles, as the API sends it. */
  totalAmount: number;
  /** End of the reservation; null if unreadable. */
  expiresAt: Date | null;
}

export interface OperatorAlert {
  id: string;
  type: string;
  raffleId: string | null;
  raffleTitle: string | null;
  orderId: string | null;
  paymentAccountId: string | null;
  amount: number | null;
  reason?: string | null;
  createdAt: Date;
}

export interface User {
  id: string;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
  name?: string | null;
  role: string;
}

export interface Session {
  accessToken: string;
  /** ISO 8601, as sent by the API. */
  expiresAt: string;
  user: User;
}

export interface CreatedRaffle {
  raffleId: string;
  status: string;
}

export interface PublishedRaffle {
  raffleId: string;
  status: string;
  commitmentHash: string;
  drandRound: string | null;
}


export interface BuyerSummary {
  id: string;
  name: string | null;
  document: string | null;
  phone: string | null;
  email: string | null;
  /** Buyers created by an in-person sale only (JUAN-PEREZ-2). */
  buyerCode?: string | null;
}

export interface RaffleOrderWithBuyer {
  id: string;
  raffleId: string;
  status: string;
  numbers: number[];
  totalAmount: number;
  declaredAmount: number | null;
  bankOrWallet: string | null;
  operationNumber: string | null;
  hasProof: boolean;
  createdAt: Date;
  verifiedAt: Date | null;
  buyer: BuyerSummary | null;
}
export interface AdminSalesReport {
  raffleId: string;
  title: string;
  status: string;
  ticketsSold: number;
  ticketsReserved: number;
  ticketsAvailable: number;
  paidAmount: number;
  ordersByStatus: Record<string, number>;
}

export interface ExecuteDrawResult {
  drawId: string;
  /** Prize 1; null when it was VOID. */
  winningNumber: number | null;
  /** Every prize's result, in order; prize 1 alone from an older API. */
  winners: { position: number; status: DrawWinnerStatus; winningNumber: number | null }[];
  drandRound: string;
  executedAt: Date;
}


export interface PendingProof extends Order {
  raffleTitle?: string | null;
  buyer?: {
    id: string;
    name: string | null;
    document: string | null;
    phone: string | null;
    email: string | null;
    buyerCode?: string | null;
  } | null;
  operationNumber: string;
}

export interface AdminRefund {
  refundId: string;
  orderId: string;
  raffleId: string;
  paymentId: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: Date;
}

export interface AdminPaymentAccount extends PaymentAccount {
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface AccountDetails {
  method: string;
  holder: string;
  number: string;
  cci: string | null;
  order: number;
}

export interface PaymentAccountChange {
  id: string;
  kind: string;
  accountId: string;
  status: string;
  proposed: AccountDetails | null;
  before: AccountDetails | null;
  proposedBy: string;
  proposedAt: Date;
  decidedBy: string | null;
  decidedAt: Date | null;
}

export interface OperationCollision {
  paymentId: string;
  orderId: string;
  bank: string;
  operationNumber: string;
  reason: string;
  operatorId: string;
  existingPaymentId: string;
  existingOrderId: string;
  receivedAt: Date;
}

export interface InPersonSaleRequest {
  numbers: number[];
  alias: string;
  phone?: string | null;
  document?: string | null;
  /** The code of a returning buyer; it wins over phone and document. */
  buyerCode?: string | null;
}

/** How the sale found an existing buyer; null when it created one. */
export type InPersonBuyerMatch = 'BUYER_CODE' | 'PHONE' | 'DOCUMENT';

export interface InPersonSaleBuyer {
  id: string;
  alias: string;
  /** Null for an existing buyer that has no code (created online or before codes). */
  buyerCode: string | null;
  existing: boolean;
  matchedBy: InPersonBuyerMatch | null;
}

export interface InPersonSale extends Order {
  buyer: InPersonSaleBuyer | null;
}
