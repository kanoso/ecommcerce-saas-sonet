import type { DrawExtraction } from '@kanoso/raffle-draw';
import type {
  DrawWinner,
  OperatorAlert,
  PaymentAccount,
  PaymentAccountChange,
  RafflePrize,
  Refund,
  TicketOrder,
} from '../../domain';
import type {
  InPersonSaleResult,
  OperationCollisionUse,
  VerificationDataResponse,
} from '../../application';
import { PrizeWinnerView, RaffleQueries } from '../../application/queries/raffle-queries';

/**
 * The response contract of spec §11: the same snake_case Spanish keys as the
 * requests, on every route. The application keeps its own English names;
 * only this file speaks the API's language.
 */

type Awaited<T> = T extends Promise<infer U> ? U : T;
type Queries = RaffleQueries;
type OrderView = ReturnType<typeof RaffleQueries.orderView>;
type Summary = Awaited<ReturnType<Queries['activeRaffles']>>[number];
type Detail = Awaited<ReturnType<Queries['raffleDetail']>>;
type AdminDetail = Awaited<ReturnType<Queries['adminRaffleDetail']>>;
type AdminSummary = Awaited<ReturnType<Queries['allRaffles']>>[number];
type Live = Awaited<ReturnType<Queries['liveData']>>;
type MyTicket = Awaited<ReturnType<Queries['ticketsOf']>>[number];
type Sales = Awaited<ReturnType<Queries['salesReport']>>;
type PendingProof = Awaited<ReturnType<Queries['pendingProofs']>>[number];

function extraction(e: DrawExtraction) {
  return {
    intento: e.attempt,
    numero: e.number,
    indice: e.index,
    digest_hex: e.digestHex,
    es_ganador: e.isWinner,
  };
}

/** Ordered prizes; posicion 1 is drawn first. */
export function prizes(list: Pick<RafflePrize, 'position' | 'title' | 'description' | 'images'>[]) {
  return list.map((p) => ({
    posicion: p.position,
    titulo: p.title,
    descripcion: p.description,
    imagenes: p.images,
  }));
}

/** One prize's result: GANADO with its ticket, or DESIERTO (VOID). */
function winner(w: Omit<DrawWinner, 'id' | 'prizeId' | 'ticketId'> & { prizeTitle?: string }) {
  return {
    posicion: w.position,
    ...(w.prizeTitle !== undefined && { titulo_premio: w.prizeTitle }),
    estado: w.status,
    numero_ganador: w.winningNumber,
    indice_ganador: w.winnerIndex,
    digest_hex: w.digestHex,
    boletos_en_juego: w.poolSize,
    excluidos: w.excludedTickets,
    extracciones: (w.extractions ?? []).map(extraction),
  };
}

const iso = (at: Date | string | null): string | null =>
  at instanceof Date ? at.toISOString() : at;

/**
 * A live draw session (DT-23): paso of total_pasos revealed. finalizada_en
 * set means everything is shown and the session never moves again.
 */
interface LiveDrawSessionView {
  step: number;
  totalSteps: number;
  startedAt: Date | string;
  updatedAt: Date | string;
  finishedAt: Date | string | null;
}

export function liveDrawSessionOf(s: LiveDrawSessionView) {
  return {
    paso: s.step,
    total_pasos: s.totalSteps,
    iniciada_en: iso(s.startedAt),
    actualizada_en: iso(s.updatedAt),
    finalizada_en: iso(s.finishedAt),
  };
}

export function liveDrawSession(s: LiveDrawSessionView | null) {
  return s ? liveDrawSessionOf(s) : null;
}

/** A prize's public result on a list: the number only, never the buyer. */
function prizeWinner(w: PrizeWinnerView) {
  return {
    posicion: w.position,
    titulo_premio: w.prizeTitle,
    estado: w.status,
    numero_ganador: w.winningNumber,
  };
}

export function raffleSummary(r: Summary) {
  return {
    rifa_id: r.id,
    titulo: r.title,
    premio: r.prize,
    precio_boleto: r.ticketPrice,
    numero_min: r.numberMin,
    numero_max: r.numberMax,
    intento_ganador: r.winningAttempt,
    efecto_sorteo: r.drawEffect,
    modalidad_sorteo: r.drawMode,
    duracion_efecto_seg: r.drawDurationSec,
    velocidad_efecto: r.drawSpeed,
    descripcion_premio: r.prizeDescription,
    imagenes_premio: r.prizeImages,
    premios: prizes(r.prizes),
    modo_exclusion_ganador: r.winnerExclusionMode,
    estado: r.status,
    cierre_ventas: r.salesCloseAt,
    fecha_sorteo: r.drawAt,
    resolucion_autorizacion: r.authorizationResolution,
    boletos_vendidos: r.ticketsSold,
    boletos_reservados: r.ticketsReserved,
    boletos_disponibles: r.ticketsAvailable,
    /** A live draw is in progress: ganadores stays empty until it finishes (DT-23). */
    sorteo_en_vivo: r.liveDrawInProgress ?? false,
    ganadores: (r.winners ?? []).map(prizeWinner),
  };
}

/**
 * An operator's view of one raffle. sorteo_rechazado: the draw of a CLOSED
 * raffle was refused for its configuration, so it can only be cancelled with
 * a full refund (DT-21); null otherwise.
 */
/** An operator's list row: the summary and the DT-21 refusal of a CLOSED raffle. */
export function adminRaffleSummary(r: AdminSummary) {
  return {
    ...raffleSummary(r),
    sorteo_rechazado: r.refusedDraw
      ? { motivo: r.refusedDraw.reason, fecha: r.refusedDraw.at }
      : null,
  };
}

export function adminRaffleDetail(d: AdminDetail) {
  return {
    ...raffleSummary(d),
    sorteo_rechazado: d.refusedDraw
      ? { motivo: d.refusedDraw.reason, fecha: d.refusedDraw.at }
      : null,
    sesion_en_vivo: liveDrawSession(d.liveSession ?? null),
    // The operator sees every prize's winner, live session or not.
    ganadores: (d.adminWinners ?? []).map((w) => ({
      ...prizeWinner(w),
      alias_comprador: w.buyerAlias,
    })),
  };
}

export function raffleDetail(d: Detail) {
  return {
    rifa: raffleSummary(d.raffle),
    grilla: {
      pagina: d.grid.page,
      tamano: d.grid.pageSize,
      total: d.grid.total,
      paginas: d.grid.pages,
      numeros: d.grid.numbers.map((n) => ({ numero: n.number, estado: n.status })),
    },
  };
}

export function liveData(l: Live) {
  return {
    rifa_id: l.raffleId,
    titulo: l.title,
    estado: l.status,
    numero_min: l.numberMin,
    numero_max: l.numberMax,
    intento_ganador: l.winningAttempt,
    efecto_sorteo: l.drawEffect,
    modalidad_sorteo: l.drawMode,
    duracion_efecto_seg: l.drawDurationSec,
    velocidad_efecto: l.drawSpeed,
    premios: prizes(l.prizes),
    modo_exclusion_ganador: l.winnerExclusionMode,
    hash_configuracion: l.drawConfigHash,
    /** BUYER mode, from the close: sold tickets grouped by buyer, without identities. */
    grupos_compradores: l.buyerGroups,
    hash_compromiso: l.commitmentHash,
    hash_cadena_drand: l.drandChainHash,
    ronda_drand: l.drandRound,
    cierre_ventas: l.salesCloseAt,
    fecha_sorteo: l.drawAt,
    hash_lista: l.soldListHash,
    semilla_revelada: l.seedRevealed,
    numeros_vendidos: l.soldNumbers,
    compradores_boletos: l.soldTicketBuyers ?? {},
    /**
     * DT-23: the server-paced reveal of a MANUAL draw. While it is in
     * progress, resultado only lists the prizes whose steps were all shown.
     */
    sesion_en_vivo: liveDrawSession(l.liveSession ?? null),
    resultado: l.result
      ? {
          numero_ganador: l.result.winningNumber,
          indice_ganador: l.result.winnerIndex,
          digest_hex: l.result.digestHex,
          aleatoriedad_drand: l.result.drandRandomness,
          intento_ganador: l.result.winningAttempt,
          extracciones: (l.result.extractions ?? []).map(extraction),
          ejecutado_en: l.result.executedAt,
          version_algoritmo: l.result.algorithmVersion,
          ganadores: l.result.winners.map(winner),
        }
      : null,
  };
}

export function verification(v: VerificationDataResponse) {
  return {
    rifa_id: v.raffleId,
    titulo: v.title,
    premio: v.prize,
    version_algoritmo: v.algorithmVersion,
    resolucion_autorizacion: v.authorizationResolution,
    estado: v.status,
    hash_compromiso: v.commitmentHash,
    semilla_revelada: v.seedRevealed,
    hash_cadena_drand: v.drandChainHash,
    ronda_drand: v.drandRound,
    /** ISO 8601; empty when unknown. The browser checks ronda_drand = roundAt(fecha_sorteo). */
    fecha_sorteo: v.drawAt,
    /** ISO 8601; empty when unknown. The browser checks ronda_drand > roundAt(cierre_ventas). */
    cierre_ventas: v.salesCloseAt,
    aleatoriedad_drand: v.drandRandomness,
    hash_lista: v.soldListHash,
    lista_verificada: v.soldListVerified,
    numeros_vendidos: v.soldNumbers,
    indice_ganador: v.winnerIndex,
    numero_ganador: v.winningNumber,
    digest_hex: v.digestHex,
    intento_ganador: v.winningAttempt,
    extracciones: (v.extractions ?? []).map(extraction),
    ejecutado_en: v.executedAt,
    premios: prizes(v.prizes),
    modo_exclusion_ganador: v.winnerExclusionMode,
    /** v2: the configuration hash frozen at the close; empty before multi-prize draws. */
    hash_configuracion: v.drawConfigHash,
    configuracion_verificada: v.drawConfigVerified,
    /** BUYER mode: sold tickets grouped by buyer, without identities. */
    grupos_compradores: v.buyerGroups,
    ganadores: v.winners.map(winner),
  };
}

export function order(o: OrderView) {
  return {
    orden_id: o.id,
    rifa_id: o.raffleId,
    estado: o.status,
    numeros: o.numbers,
    monto_total: o.totalAmount,
    vence_en: o.expiresAt,
    verificacion_vence_en: o.verificationDueAt,
    monto_declarado: o.declaredAmount,
    banco_o_billetera: o.bankOrWallet,
    motivo_rechazo: o.rejectionReason,
    tiene_comprobante: o.hasProof,
    creada_en: o.createdAt,
    // The account the buyer declared paying to, as it was then (DT-19).
    cuenta_destino: o.paidToAccount
      ? {
          cuenta_id: o.paidToAccount.accountId,
          metodo: o.paidToAccount.method,
          titular: o.paidToAccount.holderName,
          numero: o.paidToAccount.accountNumber,
          cci: o.paidToAccount.cci,
          version: o.paidToAccount.version,
        }
      : null,
  };
}

export const orderOf = (o: TicketOrder) => order(RaffleQueries.orderView(o));

/** The order of an in-person sale, with the buyer it was recorded to. */
export function inPersonSale(sale: InPersonSaleResult) {
  return {
    ...orderOf(sale.order),
    comprador: {
      id: sale.buyer.id,
      alias: sale.buyer.alias,
      codigo_comprador: sale.buyer.buyerCode,
      existente: sale.buyer.matchedBy !== null,
      coincidencia: sale.buyer.matchedBy,
    },
  };
}

export function pendingProof(p: PendingProof) {
  return {
    ...order(p),
    numero_operacion: p.operationNumber,
    titulo_rifa: p.raffleTitle ?? null,
    comprador: p.buyer
      ? {
          id: p.buyer.id,
          nombre: p.buyer.name,
          documento: p.buyer.document,
          celular: p.buyer.phone,
          email: p.buyer.email,
          codigo_comprador: p.buyer.buyerCode ?? null,
        }
      : null,
  };
}

export function myTicket(t: MyTicket) {
  return {
    orden_id: t.orderId,
    rifa_id: t.raffleId,
    titulo_rifa: t.raffleTitle,
    numeros: t.numbers,
    estado: t.status,
    monto_total: t.totalAmount,
    vence_en: t.expiresAt,
  };
}

export function sales(s: Sales) {
  return {
    rifa_id: s.raffleId,
    titulo: s.title,
    estado: s.status,
    boletos_vendidos: s.ticketsSold,
    boletos_reservados: s.ticketsReserved,
    boletos_disponibles: s.ticketsAvailable,
    monto_pagado: s.paidAmount,
    ordenes_por_estado: s.ordersByStatus,
  };
}

export function alert(a: OperatorAlert) {
  return {
    alerta_id: a.id,
    tipo: a.type,
    rifa_id: a.raffleId,
    titulo_rifa: a.raffleTitle,
    orden_id: a.orderId,
    cuenta_pago_id: a.paymentAccountId,
    monto: a.amount,
    motivo: a.reason,
    creada_en: a.createdAt.toISOString(),
  };
}

export function refund(r: Refund) {
  return {
    reembolso_id: r.id,
    orden_id: r.orderId,
    rifa_id: r.raffleId,
    pago_id: r.paymentId,
    monto: r.amount,
    motivo: r.reason,
    estado: r.status,
    creado_en: r.createdAt.toISOString(),
  };
}

export function collision(c: OperationCollisionUse) {
  return {
    pago_id: c.paymentId,
    orden_id: c.orderId,
    banco: c.bank,
    numero_operacion: c.operationNumber,
    motivo: c.reason,
    operador_id: c.operatorId,
    pago_existente_id: c.existingPaymentId,
    orden_existente_id: c.existingOrderId,
    recibido_en: c.receivedAt.toISOString(),
  };
}

/**
 * The order a buyer reads while paying, with the server clock: the web
 * counts the reservation down from it instead of trusting the device clock.
 */
export function orderWithServerTime(o: OrderView, now: Date) {
  return { ...order(o), hora_servidor: now.toISOString() };
}

/** What a buyer needs to transfer: no state, no audit, no operator ids. */
export function publicPaymentAccount(a: PaymentAccount) {
  return {
    cuenta_id: a.id,
    metodo: a.method,
    titular: a.holderName,
    numero: a.accountNumber,
    cci: a.cci,
    // The proof sends it back as cuenta_version (DT-19).
    version: a.version,
  };
}

export function adminPaymentAccount(a: PaymentAccount) {
  return {
    ...publicPaymentAccount(a),
    orden: a.displayOrder,
    activa: a.active,
    creada_en: a.createdAt.toISOString(),
    actualizada_en: a.updatedAt.toISOString(),
    creada_por: a.createdBy,
    actualizada_por: a.updatedBy,
  };
}

function accountDetails(d: PaymentAccountChange['proposed']) {
  return d
    ? { metodo: d.method, titular: d.holderName, numero: d.accountNumber, cci: d.cci, orden: d.displayOrder }
    : null;
}

/** A four-eyes change for the operators (DT-19): what, by whom, and the state before. */
export function paymentAccountChange(c: PaymentAccountChange) {
  return {
    solicitud_id: c.id,
    tipo: c.kind,
    cuenta_id: c.accountId,
    estado: c.status,
    propuesta: accountDetails(c.proposed),
    anterior: accountDetails(c.before),
    propuesta_por: c.proposedBy,
    propuesta_en: c.proposedAt.toISOString(),
    decidida_por: c.decidedBy,
    decidida_en: c.decidedAt?.toISOString() ?? null,
  };
}
