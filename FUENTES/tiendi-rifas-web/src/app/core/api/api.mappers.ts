import {
  LiveDataDto,
  MyTicketDto,
  NumberStatusDto,
  AdminSalesReportDto,
  RaffleOrderWithBuyerDto,
  CreatedRaffleDto,
  ExecuteDrawDto,
  OperatorAlertDto,
  PublishedRaffleDto,
  OrderDto,
  InPersonSaleRequestDto,
  PaymentAccountDto,
  RaffleDetailDto,
  RaffleSummaryDto,
  SessionDto,
  UserDto,
  VerificationDataDto,
} from './api.dto';
import {
  Commitment,
  MyTicket,
  NumberStatus,
  AdminSalesReport,
  RaffleOrderWithBuyer,
  CreatedRaffle,
  ExecuteDrawResult,
  OperatorAlert,
  PublishedRaffle,
  Order,
  InPersonSaleRequest,
  PaymentAccount,
  RaffleDetail,
  RaffleSummary,
  Session,
  LiveRaffleData,
  RaffleStatusInfo,
  User,
  VerificationData,
} from './api.models';

/** An unreadable date becomes null, so an Invalid Date never reaches Intl. */
function dateOrNull(iso: string | null | undefined): Date | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The progress counts are read defensively: an older API omits them, and the
 * card then falls back to the size of the range.
 */
const countOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;

const textOrNull = (value: string | null | undefined): string | null =>
  value && value.trim() !== '' ? value.trim() : null;

export function toRaffleSummary(dto: RaffleSummaryDto): RaffleSummary {
  return {
    id: dto.rifa_id,
    title: dto.titulo,
    prize: dto.premio,
    ticketPrice: dto.precio_boleto,
    numberMin: dto.numero_min,
    numberMax: dto.numero_max,
    totalNumbers: dto.numero_max - dto.numero_min + 1,
    status: dto.estado,
    salesCloseAt: dateOrNull(dto.cierre_ventas),
    drawAt: dateOrNull(dto.fecha_sorteo),
    soldCount: countOrNull(dto.boletos_vendidos),
    availableCount: countOrNull(dto.boletos_disponibles),
    drawMode: dto.modalidad_sorteo ?? 'AUTOMATIC',
    drawDurationSec: typeof dto.duracion_efecto_seg === 'number' ? dto.duracion_efecto_seg : 4,
    drawSpeed: dto.velocidad_efecto ?? 'NORMAL',
    authorizationResolution: textOrNull(dto.resolucion_autorizacion),
    winningAttempt: typeof dto.intento_ganador === 'number' ? dto.intento_ganador : 1,
    drawEffect: dto.efecto_sorteo ?? 'SLOT_MACHINE',
    prizeDescription: textOrNull(dto.descripcion_premio),
    prizeImages: Array.isArray(dto.imagenes_premio) ? dto.imagenes_premio : [],
  };
}

const NUMBER_STATUSES: readonly string[] = ['AVAILABLE', 'RESERVED', 'SOLD', 'UNAVAILABLE'];

/** A status this app does not know is never offered for sale. */
const toNumberStatus = (status: NumberStatusDto): NumberStatus =>
  NUMBER_STATUSES.includes(status) ? (status as NumberStatus) : 'UNAVAILABLE';

export function toRaffleDetail(dto: RaffleDetailDto): RaffleDetail {
  const grid = dto.grilla;
  return {
    raffle: toRaffleSummary(dto.rifa),
    grid: {
      page: grid.pagina,
      pageSize: grid.tamano,
      total: grid.total,
      pages: grid.paginas,
      numbers: grid.numeros.map((n) => ({ number: n.numero, status: toNumberStatus(n.estado) })),
    },
  };
}

export function toCommitment(dto: LiveDataDto): Commitment {
  return {
    commitmentHash: textOrNull(dto.hash_compromiso),
    drandRound: textOrNull(dto.ronda_drand),
  };
}

export function toOrder(dto: OrderDto): Order {
  return {
    id: dto.orden_id,
    raffleId: dto.rifa_id,
    status: dto.estado,
    numbers: dto.numeros,
    totalAmount: dto.monto_total,
    expiresAt: dateOrNull(dto.vence_en),
    verificationDueAt: dateOrNull(dto.verificacion_vence_en),
    declaredAmount: dto.monto_declarado ?? null,
    bankOrWallet: dto.banco_o_billetera ?? null,
    rejectionReason: textOrNull(dto.motivo_rechazo),
    hasProof: dto.tiene_comprobante === true,
    paidToAccount: dto.cuenta_destino ? toPaymentAccount(dto.cuenta_destino) : null,
  };
}

export function toMyTicket(dto: MyTicketDto): MyTicket {
  return {
    orderId: dto.orden_id,
    raffleId: dto.rifa_id,
    raffleTitle: dto.titulo_rifa,
    numbers: dto.numeros,
    status: dto.estado,
    totalAmount: dto.monto_total,
    expiresAt: dateOrNull(dto.vence_en),
  };
}

const METHOD_LABELS: Record<string, string> = {
  YAPE: 'Yape',
  PLIN: 'Plin',
  BCP: 'BCP',
  BBVA: 'BBVA',
  INTERBANK: 'Interbank',
  EFECTIVO: 'Efectivo',
};

/** An unknown method keeps its code as the label: the account still shows. */
export function toPaymentAccount(dto: PaymentAccountDto): PaymentAccount {
  return {
    id: dto.cuenta_id,
    method: dto.metodo,
    label: METHOD_LABELS[dto.metodo] ?? dto.metodo,
    holder: dto.titular,
    number: dto.numero,
    cci: dto.cci ?? null,
    version: dto.version,
  };
}

/** The server clock of an order read; null when missing or unreadable. */
export function serverTimeOf(dto: OrderDto): Date | null {
  return dateOrNull(dto.hora_servidor);
}

export function toOperatorAlert(dto: OperatorAlertDto): OperatorAlert {
  return {
    id: dto.alerta_id,
    type: dto.tipo,
    raffleId: dto.rifa_id,
    raffleTitle: dto.titulo_rifa,
    orderId: dto.orden_id,
    paymentAccountId: dto.cuenta_pago_id,
    amount: dto.monto,
    reason: dto.motivo ?? null,
    createdAt: new Date(dto.creada_en),
  };
}

export function toUser(dto: UserDto): User {
  return {
    id: dto.usuario_id,
    email: dto.email ?? null,
    document: dto.documento ?? null,
    phone: dto.celular ?? null,
    name: dto.nombre ?? null,
    role: dto.rol,
  };
}

export function toSession(dto: SessionDto): Session {
  return {
    accessToken: dto.token_acceso,
    expiresAt: dto.vence_en,
    user: toUser(dto.usuario),
  };
}

export function toVerificationData(dto: VerificationDataDto): VerificationData {
  return {
    raffleId: dto.rifa_id,
    title: dto.titulo,
    prize: dto.premio,
    algorithmVersion: dto.version_algoritmo,
    authorizationResolution: textOrNull(dto.resolucion_autorizacion),
    status: dto.estado,
    commitmentHash: dto.hash_compromiso,
    seedRevealed: dto.semilla_revelada,
    drandChainHash: dto.hash_cadena_drand,
    drandRound: dto.ronda_drand,
    drawAt: dateOrNull(dto.fecha_sorteo),
    salesCloseAt: dateOrNull(dto.cierre_ventas),
    soldListHash: dto.hash_lista,
    // A list the API did not explicitly vouch for is never treated as intact.
    soldListVerified: dto.lista_verificada === true,
    soldNumbers: dto.numeros_vendidos,
    winningAttempt: typeof dto.intento_ganador === 'number' ? dto.intento_ganador : 1,
    extractions: (dto.extracciones ?? []).map((e) => ({
      attempt: e.intento,
      number: e.numero,
      index: e.indice,
      digestHex: e.digest_hex,
      isWinner: e.es_ganador,
    })),
    official: {
      drandRandomness: dto.aleatoriedad_drand,
      winnerIndex: dto.indice_ganador,
      winningNumber: dto.numero_ganador,
      digestHex: dto.digest_hex,
      executedAt: dateOrNull(dto.ejecutado_en),
    },
  };
}

export function toRaffleStatusInfo(dto: LiveDataDto): RaffleStatusInfo {
  return { title: dto.titulo, status: dto.estado };
}


export function toLiveRaffleData(dto: LiveDataDto): LiveRaffleData {
  const result = dto.resultado
    ? {
        drandRandomness: dto.resultado.aleatoriedad_drand,
        winnerIndex: dto.resultado.indice_ganador,
        winningNumber: dto.resultado.numero_ganador,
        digestHex: dto.resultado.digest_hex,
        winningAttempt: dto.resultado.intento_ganador,
        extractions: (dto.resultado.extracciones ?? []).map((e) => ({
          attempt: e.intento,
          number: e.numero,
          index: e.indice,
          digestHex: e.digest_hex,
          isWinner: e.es_ganador,
        })),
        executedAt: dateOrNull(dto.resultado.ejecutado_en),
      }
    : null;
  return {
    raffleId: dto.rifa_id,
    title: dto.titulo,
    status: dto.estado,
    winningAttempt: typeof dto.intento_ganador === 'number' ? dto.intento_ganador : 1,
    drawEffect: dto.efecto_sorteo ?? 'SLOT_MACHINE',
    commitmentHash: dto.hash_compromiso,
    drandChainHash: dto.hash_cadena_drand,
    drandRound: dto.ronda_drand,
    salesCloseAt: dateOrNull(dto.cierre_ventas),
    drawAt: dateOrNull(dto.fecha_sorteo),
    soldListHash: dto.hash_lista,
    seedRevealed: dto.semilla_revelada,
    soldNumbers: dto.numeros_vendidos,
    result,
    numberMin: dto.numero_min ?? 1,
    soldTicketBuyers: dto.compradores_boletos
      ? Object.fromEntries(
          Object.entries(dto.compradores_boletos).map(([k, v]) => [Number(k), v]),
        )
      : {},
    drawMode: dto.modalidad_sorteo ?? 'AUTOMATIC',
    drawDurationSec: typeof dto.duracion_efecto_seg === 'number' ? dto.duracion_efecto_seg : 4,
    drawSpeed: dto.velocidad_efecto ?? 'NORMAL',
    numberMax: dto.numero_max ?? (dto.numeros_vendidos?.length ? Math.max(...dto.numeros_vendidos, 30) : 30),
  };
}
export function toCreatedRaffle(dto: CreatedRaffleDto): CreatedRaffle {
  return {
    raffleId: dto.rifa_id,
    status: dto.estado,
  };
}

export function toPublishedRaffle(dto: PublishedRaffleDto): PublishedRaffle {
  return {
    raffleId: dto.rifa_id,
    status: dto.estado,
    commitmentHash: dto.hash_compromiso,
    drandRound: dto.ronda_drand,
  };
}

export function toAdminSalesReport(dto: AdminSalesReportDto): AdminSalesReport {
  return {
    raffleId: dto.rifa_id,
    title: dto.titulo,
    status: dto.estado,
    ticketsSold: dto.boletos_vendidos,
    ticketsReserved: dto.boletos_reservados,
    ticketsAvailable: dto.boletos_disponibles,
    paidAmount: dto.monto_pagado,
    ordersByStatus: dto.ordenes_por_estado ?? {},
  };
}

export function toExecuteDrawResult(dto: ExecuteDrawDto): ExecuteDrawResult {
  return {
    drawId: dto.sorteo_id,
    winningNumber: dto.numero_ganador,
    drandRound: dto.ronda_drand,
    executedAt: new Date(dto.ejecutado_en),
  };
}

import {
  AccountDetailsDto,
  AdminPaymentAccountDto,
  AdminRefundDto,
  OperationCollisionDto,
  PaymentAccountChangeDto,
  PendingProofDto,
} from './api.dto';
import {
  AccountDetails,
  AdminPaymentAccount,
  AdminRefund,
  OperationCollision,
  PaymentAccountChange,
  PendingProof,
} from './api.models';

export function toPendingProof(dto: PendingProofDto): PendingProof {
  return {
    ...toOrder(dto),
    raffleTitle: dto.titulo_rifa ?? null,
    buyer: dto.comprador
      ? {
          id: dto.comprador.id,
          name: dto.comprador.nombre ?? null,
          document: dto.comprador.documento ?? null,
          phone: dto.comprador.celular ?? null,
          email: dto.comprador.email ?? null,
        }
      : null,
    operationNumber: dto.numero_operacion,
  };
}

export function toAdminRefund(dto: AdminRefundDto): AdminRefund {
  return {
    refundId: dto.reembolso_id,
    orderId: dto.orden_id,
    raffleId: dto.rifa_id,
    paymentId: dto.pago_id,
    amount: dto.monto,
    reason: dto.motivo,
    status: dto.estado,
    createdAt: new Date(dto.creado_en),
  };
}

export function toAdminPaymentAccount(dto: AdminPaymentAccountDto): AdminPaymentAccount {
  return {
    ...toPaymentAccount(dto),
    order: dto.orden,
    active: dto.activa,
    createdAt: new Date(dto.creada_en),
    updatedAt: new Date(dto.actualizada_en),
    createdBy: dto.creada_por,
    updatedBy: dto.actualizada_por,
  };
}

export function toAccountDetails(dto: AccountDetailsDto | null): AccountDetails | null {
  if (!dto) return null;
  return {
    method: dto.metodo,
    holder: dto.titular,
    number: dto.numero,
    cci: dto.cci ?? null,
    order: dto.orden,
  };
}

export function toPaymentAccountChange(dto: PaymentAccountChangeDto): PaymentAccountChange {
  return {
    id: dto.solicitud_id,
    kind: dto.tipo,
    accountId: dto.cuenta_id,
    status: dto.estado,
    proposed: toAccountDetails(dto.propuesta),
    before: toAccountDetails(dto.anterior),
    proposedBy: dto.propuesta_por,
    proposedAt: new Date(dto.propuesta_en),
    decidedBy: dto.decidida_por ?? null,
    decidedAt: dto.decidida_en ? new Date(dto.decidida_en) : null,
  };
}

export function toOperationCollision(dto: OperationCollisionDto): OperationCollision {
  return {
    paymentId: dto.pago_id,
    orderId: dto.orden_id,
    bank: dto.banco,
    operationNumber: dto.numero_operacion,
    reason: dto.motivo,
    operatorId: dto.operador_id,
    existingPaymentId: dto.pago_existente_id,
    existingOrderId: dto.orden_existente_id,
    receivedAt: new Date(dto.recibido_en),
  };
}


export function toRaffleOrderWithBuyer(dto: RaffleOrderWithBuyerDto): RaffleOrderWithBuyer {
  return {
    id: dto.orden_id,
    raffleId: dto.rifa_id,
    status: dto.estado,
    numbers: dto.numeros,
    totalAmount: dto.monto_total,
    declaredAmount: dto.monto_declarado,
    bankOrWallet: dto.banco_o_billetera,
    operationNumber: dto.numero_operacion,
    hasProof: dto.tiene_comprobante,
    createdAt: new Date(dto.creada_en),
    verifiedAt: dto.verificada_en ? new Date(dto.verificada_en) : null,
    buyer: dto.comprador
      ? {
          id: dto.comprador.id,
          name: dto.comprador.nombre ?? dto.comprador.name ?? null,
          document: dto.comprador.documento ?? dto.comprador.document ?? null,
          phone: dto.comprador.celular ?? dto.comprador.phone ?? null,
          email: dto.comprador.email ?? null,
        }
      : null,
  };
}

export function toInPersonSaleDto(req: InPersonSaleRequest): InPersonSaleRequestDto {
  return {
    numeros: req.numbers,
    alias: req.alias,
    telefono: req.phone,
    documento: req.document ?? null,
  };
}

