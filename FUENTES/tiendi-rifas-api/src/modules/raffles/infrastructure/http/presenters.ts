import type { OperatorAlert, PaymentAccount, PaymentAccountChange, Refund, TicketOrder } from '../../domain';
import type { OperationCollisionUse, VerificationDataResponse } from '../../application';
import { RaffleQueries } from '../../application/queries/raffle-queries';

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
type Live = Awaited<ReturnType<Queries['liveData']>>;
type MyTicket = Awaited<ReturnType<Queries['ticketsOf']>>[number];
type Sales = Awaited<ReturnType<Queries['salesReport']>>;
type PendingProof = Awaited<ReturnType<Queries['pendingProofs']>>[number];

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
    estado: r.status,
    cierre_ventas: r.salesCloseAt,
    fecha_sorteo: r.drawAt,
    resolucion_autorizacion: r.authorizationResolution,
    boletos_vendidos: r.ticketsSold,
    boletos_reservados: r.ticketsReserved,
    boletos_disponibles: r.ticketsAvailable,
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
    hash_compromiso: l.commitmentHash,
    hash_cadena_drand: l.drandChainHash,
    ronda_drand: l.drandRound,
    cierre_ventas: l.salesCloseAt,
    fecha_sorteo: l.drawAt,
    hash_lista: l.soldListHash,
    semilla_revelada: l.seedRevealed,
    numeros_vendidos: l.soldNumbers,
    compradores_boletos: l.soldTicketBuyers ?? {},
    resultado: l.result
      ? {
          numero_ganador: l.result.winningNumber,
          indice_ganador: l.result.winnerIndex,
          digest_hex: l.result.digestHex,
          aleatoriedad_drand: l.result.drandRandomness,
          intento_ganador: l.result.winningAttempt,
          extracciones: (l.result.extractions ?? []).map((e) => ({
            intento: e.attempt,
            numero: e.number,
            indice: e.index,
            digest_hex: e.digestHex,
            es_ganador: e.isWinner,
          })),
          ejecutado_en: l.result.executedAt,
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
    extracciones: (v.extractions ?? []).map((e) => ({
      intento: e.attempt,
      numero: e.number,
      indice: e.index,
      digest_hex: e.digestHex,
      es_ganador: e.isWinner,
    })),
    ejecutado_en: v.executedAt,
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
