/**
 * Wire shapes of tiendi-rifas-api (spec §11, presenters.ts). Spanish
 * snake_case keys stay here and in api.mappers.ts; the rest of the app
 * works with the camelCase view models.
 */

export type RaffleStatusDto = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'DRAWN' | 'CANCELLED' | string;

export type DrawEffectDto = 'SLOT_MACHINE' | 'TOMBOLA' | 'SUSPENSE_CONFETTI' | 'SNAKE' | 'RADAR';
export type DrawModeDto = 'AUTOMATIC' | 'MANUAL';
export type DrawSpeedDto = 'SLOW' | 'NORMAL' | 'FAST';

export interface DrawExtractionDto {
  intento: number;
  numero: number;
  indice: number;
  digest_hex: string;
  es_ganador: boolean;
}

/** One item of `GET /api/rifas`. */
export interface RaffleSummaryDto {
  rifa_id: string;
  titulo: string;
  premio: string;
  precio_boleto: number;
  numero_min: number;
  numero_max: number;
  estado: RaffleStatusDto;
  intento_ganador?: number;
  efecto_sorteo?: DrawEffectDto;
  descripcion_premio?: string | null;
  imagenes_premio?: string[];
  cierre_ventas: string | null;
  fecha_sorteo: string | null;
  /** Null while the raffle has no resolution (only drafts). */
  modalidad_sorteo?: DrawModeDto;
  duracion_efecto_seg?: number;
  velocidad_efecto?: DrawSpeedDto;
  resolucion_autorizacion: string | null;
  /** Numbers whose payment was approved (ticket status SOLD). */
  boletos_vendidos: number;
  /** Numbers held by an order awaiting payment or proof check: not sold, not offered. */
  boletos_reservados: number;
  /** Numbers a buyer can reserve now (ticket status AVAILABLE). */
  boletos_disponibles: number;
}

/** Public status of one number (PUBLIC_STATUS of raffle-queries.ts). */
export type NumberStatusDto = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'UNAVAILABLE' | string;

/** `GET /api/rifas/:id?pagina=&tamano=`: the raffle and one page of its grid. */
export interface RaffleDetailDto {
  rifa: RaffleSummaryDto;
  grilla: {
    pagina: number;
    tamano: number;
    total: number;
    paginas: number;
    numeros: { numero: number; estado: NumberStatusDto }[];
  };
}

/** `GET /api/rifas/:id/en-vivo`. The seed and the list stay null until the close. */
export interface OfficialResultDto {
  numero_ganador: number;
  indice_ganador: number;
  digest_hex: string;
  aleatoriedad_drand: string;
  intento_ganador?: number;
  extracciones?: DrawExtractionDto[];
  ejecutado_en: string;
}

export interface LiveDataDto {
  rifa_id: string;
  titulo: string;
  estado: RaffleStatusDto;
  intento_ganador?: number;
  efecto_sorteo?: DrawEffectDto;
  descripcion_premio?: string | null;
  imagenes_premio?: string[];
  hash_compromiso: string | null;
  hash_cadena_drand: string | null;
  /** Decimal string: a drand round can outgrow a JS number. */
  ronda_drand: string | null;
  cierre_ventas: string | null;
  fecha_sorteo: string | null;
  hash_lista: string | null;
  semilla_revelada: string | null;
  numeros_vendidos: number[] | null;
  resultado: OfficialResultDto | null;
  compradores_boletos?: Record<string, string>;
  numero_min?: number;
  numero_max?: number;
  modalidad_sorteo?: DrawModeDto;
  duracion_efecto_seg?: number;
  velocidad_efecto?: DrawSpeedDto;
}

/**
 * `GET /api/rifas/:id/verificacion` (presenters.ts `verification`). Answers
 * 409 DRAW_NOT_POSSIBLE while the raffle has no draw, cancelled ones included.
 */
export interface VerificationDataDto {
  rifa_id: string;
  titulo: string;
  premio: string;
  version_algoritmo: string;
  /** Empty string when the raffle has none. */
  resolucion_autorizacion: string;
  estado: RaffleStatusDto;
  intento_ganador?: number;
  efecto_sorteo?: DrawEffectDto;
  descripcion_premio?: string | null;
  imagenes_premio?: string[];
  hash_compromiso: string;
  semilla_revelada: string;
  hash_cadena_drand: string;
  /** Decimal string: the round fixed before sales opened (DT-18). */
  ronda_drand: string;
  /** ISO 8601; empty when unknown. Publishing fixed `ronda_drand` = roundAt(fecha_sorteo). */
  fecha_sorteo: string;
  /** ISO 8601; empty when unknown. `ronda_drand` must be later than roundAt(cierre_ventas). */
  cierre_ventas: string;
  aleatoriedad_drand: string;
  extracciones?: DrawExtractionDto[];
  hash_lista: string;
  /** False when the sold numbers no longer hash to `hash_lista` (DT-11). */
  lista_verificada: boolean;
  numeros_vendidos: number[];
  indice_ganador: number;
  numero_ganador: number;
  digest_hex: string;
  ejecutado_en: string;
}

/** `POST /api/reservas` body. The API rejects any other key. */
export interface ReservationRequestDto {
  rifa_id: string;
  numeros: number[];
}

/** An order, as `POST /api/reservas` (201) and `GET /api/ordenes/:id` answer it. */
export interface OrderDto {
  orden_id: string;
  rifa_id: string;
  estado: string;
  numeros: number[];
  monto_total: number;
  /** End of the reservation, set by the server (RESERVATION_TTL_MINUTES). */
  vence_en: string;
  verificacion_vence_en: string | null;
  monto_declarado: number | null;
  banco_o_billetera: string | null;
  motivo_rechazo: string | null;
  tiene_comprobante: boolean;
  creada_en: string;
  /**
   * The server clock when it answered (ISO 8601). Only on the order a buyer
   * reads while paying: `GET /ordenes/:id` and the proof upload.
   */
  hora_servidor?: string | null;
  /**
   * The operator account the buyer declared paying to, copied when the proof
   * was sent (DT-19); null before it.
   */
  cuenta_destino?: PaymentAccountDto | null;
}

/**
 * One item of `GET /api/mis-boletos` (presenters.myTicket): an order of the
 * session user, newest first. `monto_total` is decimal soles. The list is a
 * bare array: it has no `hora_servidor`.
 */
export interface MyTicketDto {
  orden_id: string;
  rifa_id: string;
  /** Empty when the raffle is no longer found. */
  titulo_rifa: string;
  numeros: number[];
  estado: string;
  monto_total: number;
  /** End of the reservation, as `vence_en` of the order (ISO 8601, UTC). */
  vence_en: string;
}

/** One item of `GET /api/cuentas-pago` (DT-19): active accounts only. */
export interface PaymentAccountDto {
  cuenta_id: string;
  metodo: string;
  titular: string;
  numero: string;
  cci: string | null;
  version: number;
}

export interface UserDto {
  usuario_id: string;
  email: string | null;
  documento?: string | null;
  celular?: string | null;
  nombre?: string | null;
  rol: string;
}

/** `POST /api/auth/sesion`. */
export interface SessionDto {
  token_acceso: string;
  vence_en: string;
  usuario: UserDto;
}

/** `POST /api/auth/enlace`, always 202. */
export interface OperatorAlertDto {
  alerta_id: string;
  tipo: string;
  rifa_id: string | null;
  titulo_rifa: string | null;
  orden_id: string | null;
  cuenta_pago_id: string | null;
  monto: number | null;
  motivo?: string | null;
  creada_en: string;
}

export interface LinkRequestedDto {
  enviado: boolean;
}

/** The uniform error body of every route. */
export interface ApiErrorBodyDto {
  code: string;
  message: string;
  details?: unknown;
}

export interface CreateRaffleDto {
  modalidad_sorteo?: string;
  duracion_efecto_seg?: number;
  velocidad_efecto?: string;
  titulo: string;
  premio: string;
  precio_boleto: number;
  numero_min: number;
  numero_max: number;
  intento_ganador?: number;
  efecto_sorteo?: string;
  descripcion_premio?: string | null;
  imagenes_premio?: string[];
}

export interface UpdateDraftRaffleDto {
  modalidad_sorteo?: string;
  duracion_efecto_seg?: number;
  velocidad_efecto?: string;
  titulo?: string;
  premio?: string;
  precio_boleto?: number;
  intento_ganador?: number;
  efecto_sorteo?: string;
  descripcion_premio?: string | null;
  imagenes_premio?: string[];
}

export interface CreatedRaffleDto {
  rifa_id: string;
  estado: string;
}

export interface PublishRaffleDto {
  resolucion_autorizacion: string;
  cierre_ventas: string;
  fecha_sorteo: string;
}

export interface PublishedRaffleDto {
  rifa_id: string;
  estado: string;
  hash_compromiso: string;
  ronda_drand: string | null;
}

export interface AdminSalesReportDto {
  rifa_id: string;
  titulo: string;
  estado: string;
  boletos_vendidos: number;
  boletos_reservados: number;
  boletos_disponibles: number;
  monto_pagado: number;
  ordenes_por_estado: Record<string, number>;
}

export interface ExecuteDrawDto {
  sorteo_id: string;
  numero_ganador: number;
  ronda_drand: string;
  ejecutado_en: string;
}

export interface CancelRaffleResponseDto {
  rifa_id: string;
  estado: string;
}



export interface BuyerSummaryDto {
  id: string;
  nombre?: string | null;
  documento?: string | null;
  celular?: string | null;
  email?: string | null;
  name?: string | null;
  document?: string | null;
  phone?: string | null;
}

export interface RaffleOrderWithBuyerDto {
  orden_id: string;
  rifa_id: string;
  estado: string;
  numeros: number[];
  monto_total: number;
  monto_declarado: number | null;
  banco_o_billetera: string | null;
  numero_operacion: string | null;
  tiene_comprobante: boolean;
  creada_en: string;
  verificada_en: string | null;
  comprador: BuyerSummaryDto | null;
}
export interface PendingProofDto extends OrderDto {
  titulo_rifa?: string | null;
  comprador?: {
    id: string;
    nombre: string | null;
    documento?: string | null;
    celular: string | null;
    email: string | null;
  } | null;
  numero_operacion: string;
}

export interface ApprovePaymentRequestDto {
  numero_operacion: string;
  monto_recibido: number;
  colision?: { motivo: string; banco: string } | null;
}

export interface RejectPaymentRequestDto {
  dinero_recibido: boolean;
  motivo: string;
  monto_recibido?: number;
  banco_o_billetera?: string;
  numero_operacion?: string;
  colision?: { motivo: string; banco: string } | null;
  sobrepago?: { confirmado: true; motivo: string } | null;
}

export interface RecordExtraTransferRequestDto {
  motivo: string;
  monto_recibido: number;
  banco_o_billetera: string;
  numero_operacion: string;
  colision?: { motivo: string; banco: string } | null;
  sobrepago?: { confirmado: true; motivo: string } | null;
}

export interface ConfirmLatePaymentRequestDto {
  monto_recibido: number;
  banco_o_billetera: string;
  numero_operacion: string;
  colision?: { motivo: string; banco: string } | null;
  sobrepago?: { confirmado: true; motivo: string } | null;
}

export interface DismissLatePaymentRequestDto {
  motivo: string;
}

export interface AdminRefundDto {
  reembolso_id: string;
  orden_id: string;
  rifa_id: string;
  pago_id: string;
  monto: number;
  motivo: string;
  estado: string;
  creado_en: string;
}

export interface CompleteRefundRequestDto {
  destino: string;
  numero_operacion: string;
}

export interface AdminPaymentAccountDto extends PaymentAccountDto {
  orden: number;
  activa: boolean;
  creada_en: string;
  actualizada_en: string;
  creada_por: string;
  actualizada_por: string;
}

export interface AccountDetailsDto {
  metodo: string;
  titular: string;
  numero: string;
  cci: string | null;
  orden: number;
}

export interface PaymentAccountChangeDto {
  solicitud_id: string;
  tipo: string;
  cuenta_id: string;
  estado: string;
  propuesta: AccountDetailsDto | null;
  anterior: AccountDetailsDto | null;
  propuesta_por: string;
  propuesta_en: string;
  decidida_por: string | null;
  decidida_en: string | null;
}

export interface CreateAccountProposalRequestDto {
  metodo: string;
  titular: string;
  numero: string;
  cci?: string | null;
  orden?: number;
}

export interface UpdateAccountProposalRequestDto {
  metodo?: string;
  titular?: string;
  numero?: string;
  cci?: string | null;
  orden?: number;
}

export interface OperationCollisionDto {
  pago_id: string;
  orden_id: string;
  banco: string;
  numero_operacion: string;
  motivo: string;
  operador_id: string;
  pago_existente_id: string;
  orden_existente_id: string;
  recibido_en: string;
}

/** `POST /api/admin/rifas/:id/venta-presencial`. */
export interface InPersonSaleRequestDto {
  numeros: number[];
  alias: string;
  telefono: string;
  documento?: string | null;
}
