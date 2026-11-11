import { LiveDataDto, MyTicketDto, OperatorAlertDto, OrderDto, RaffleDetailDto, RaffleOrderWithBuyerDto, RaffleSummaryDto, SessionDto } from './api.dto';
import { toCommitment, toMyTicket, toOperatorAlert, toOrder, toRaffleDetail, toRaffleOrderWithBuyer, toRaffleSummary, toSession } from './api.mappers';

const raffleDto: RaffleSummaryDto = {
  rifa_id: '11111111-1111-4111-8111-111111111111',
  titulo: 'Smart TV 55"',
  premio: 'Un televisor',
  precio_boleto: 10,
  numero_min: 1,
  numero_max: 1000,
  estado: 'ACTIVE',
  cierre_ventas: '2026-11-16T01:00:00.000Z',
  fecha_sorteo: '2026-11-17T01:00:00.000Z',
  resolucion_autorizacion: 'RD-123-2026',
  boletos_vendidos: 640,
  boletos_reservados: 10,
  boletos_disponibles: 350,
};

/** A response from an API older than RF-01: none of the progress keys. */
function withoutProgress(): RaffleSummaryDto {
  const legacy: Partial<RaffleSummaryDto> = { ...raffleDto };
  delete legacy.resolucion_autorizacion;
  delete legacy.boletos_vendidos;
  delete legacy.boletos_reservados;
  delete legacy.boletos_disponibles;
  return legacy as RaffleSummaryDto;
}

describe('toRaffleSummary', () => {
  it('maps the API keys to the view model', () => {
    expect(toRaffleSummary(raffleDto)).toEqual({
      id: raffleDto.rifa_id,
      title: 'Smart TV 55"',
      prize: 'Un televisor',
      ticketPrice: 10,
      numberMin: 1,
      numberMax: 1000,
      totalNumbers: 1000,
      status: 'ACTIVE',
      salesCloseAt: new Date('2026-11-16T01:00:00.000Z'),
      drawAt: new Date('2026-11-17T01:00:00.000Z'),
      soldCount: 640,
      availableCount: 350,
      authorizationResolution: 'RD-123-2026',
      winningAttempt: 1,
      drawEffect: 'SLOT_MACHINE',
      drawMode: 'AUTOMATIC',
      drawDurationSec: 4,
      drawSpeed: 'NORMAL',
      prizeDescription: null,
      prizeImages: [],
    });
  });

  it('keeps the progress unknown when an older API omits it', () => {
    const summary = toRaffleSummary(withoutProgress());
    expect(summary.soldCount).toBeNull();
    expect(summary.availableCount).toBeNull();
    expect(summary.authorizationResolution).toBeNull();
  });

  it('ignores counts that are not whole non-negative numbers', () => {
    const summary = toRaffleSummary({
      ...raffleDto,
      boletos_vendidos: -1,
      boletos_disponibles: '12' as unknown as number,
    });
    expect(summary.soldCount).toBeNull();
    expect(summary.availableCount).toBeNull();
  });

  it('turns an invalid date into null rather than an Invalid Date', () => {
    const summary = toRaffleSummary({ ...raffleDto, cierre_ventas: 'tomorrow', fecha_sorteo: '2026-13-45' });
    expect(summary.salesCloseAt).toBeNull();
    expect(summary.drawAt).toBeNull();
  });

  it('counts the numbers of a range that does not start at one', () => {
    expect(toRaffleSummary({ ...raffleDto, numero_min: 0, numero_max: 99 }).totalNumbers).toBe(100);
  });

  it('keeps missing dates as null', () => {
    const summary = toRaffleSummary({ ...raffleDto, cierre_ventas: null, fecha_sorteo: null });
    expect(summary.salesCloseAt).toBeNull();
    expect(summary.drawAt).toBeNull();
  });

  it('treats a blank or null resolution as missing', () => {
    expect(toRaffleSummary({ ...raffleDto, resolucion_autorizacion: '  ' }).authorizationResolution).toBeNull();
    expect(toRaffleSummary({ ...raffleDto, resolucion_autorizacion: null }).authorizationResolution).toBeNull();
  });
});

describe('toSession', () => {
  it('maps the session response', () => {
    const dto: SessionDto = {
      token_acceso: 'abc',
      vence_en: '2026-11-10T00:00:00.000Z',
      usuario: { usuario_id: 'u-1', email: 'ana@example.com', rol: 'BUYER' },
    };
    expect(toSession(dto)).toEqual({
      accessToken: 'abc',
      expiresAt: '2026-11-10T00:00:00.000Z',
      user: { id: 'u-1', email: 'ana@example.com', document: null, phone: null, name: null, role: 'BUYER' },
    });
  });
});

describe('toRaffleDetail', () => {
  const detailDto = (numeros: RaffleDetailDto['grilla']['numeros']): RaffleDetailDto => ({
    rifa: raffleDto,
    grilla: { pagina: 2, tamano: 42, total: 1000, paginas: 24, numeros },
  });

  it('maps the raffle and one page of the grid', () => {
    const detail = toRaffleDetail(
      detailDto([
        { numero: 43, estado: 'AVAILABLE' },
        { numero: 44, estado: 'RESERVED' },
        { numero: 45, estado: 'SOLD' },
        { numero: 46, estado: 'UNAVAILABLE' },
      ]),
    );
    expect(detail.raffle.id).toBe(raffleDto.rifa_id);
    expect(detail.grid).toEqual({
      page: 2,
      pageSize: 42,
      total: 1000,
      pages: 24,
      numbers: [
        { number: 43, status: 'AVAILABLE' },
        { number: 44, status: 'RESERVED' },
        { number: 45, status: 'SOLD' },
        { number: 46, status: 'UNAVAILABLE' },
      ],
    });
  });

  it('never offers a number whose status it does not know', () => {
    const detail = toRaffleDetail(detailDto([{ numero: 7, estado: 'SOMETHING_NEW' }]));
    expect(detail.grid.numbers).toEqual([{ number: 7, status: 'UNAVAILABLE' }]);
  });
});

describe('toCommitment', () => {
  const liveDto: LiveDataDto = {
    rifa_id: raffleDto.rifa_id,
    titulo: 'Smart TV 55"',
    estado: 'ACTIVE',
    hash_compromiso: 'a'.repeat(64),
    hash_cadena_drand: 'b'.repeat(64),
    ronda_drand: '5204117',
    cierre_ventas: null,
    fecha_sorteo: null,
    hash_lista: null,
    semilla_revelada: null,
    numeros_vendidos: null,
    resultado: null,
  };

  it('keeps the commitment hash and the drand round', () => {
    expect(toCommitment(liveDto)).toEqual({ commitmentHash: 'a'.repeat(64), drandRound: '5204117' });
  });

  it('treats missing values as null', () => {
    expect(toCommitment({ ...liveDto, hash_compromiso: null, ronda_drand: null })).toEqual({
      commitmentHash: null,
      drandRound: null,
    });
  });
});

describe('toOrder', () => {
  const orderDto: OrderDto = {
    orden_id: '99999999-9999-4999-8999-999999999999',
    rifa_id: raffleDto.rifa_id,
    estado: 'PENDING',
    numeros: [7, 23],
    monto_total: 20,
    vence_en: '2026-11-03T15:15:00.000Z',
    verificacion_vence_en: null,
    monto_declarado: null,
    banco_o_billetera: null,
    motivo_rechazo: null,
    tiene_comprobante: false,
    creada_en: '2026-11-03T15:00:00.000Z',
  };

  it('maps a reservation and keeps the server expiry', () => {
    expect(toOrder(orderDto)).toEqual({
      id: orderDto.orden_id,
      raffleId: raffleDto.rifa_id,
      status: 'PENDING',
      numbers: [7, 23],
      totalAmount: 20,
      expiresAt: new Date('2026-11-03T15:15:00.000Z'),
      verificationDueAt: null,
      declaredAmount: null,
      bankOrWallet: null,
      rejectionReason: null,
      hasProof: false,
      paidToAccount: null,
    });
  });

  it('maps what the buyer declared and the outcome of the verification', () => {
    const order = toOrder({
      ...orderDto,
      estado: 'REFUND_PENDING',
      verificacion_vence_en: '2026-11-04T03:00:00.000Z',
      monto_declarado: 20,
      banco_o_billetera: 'YAPE',
      motivo_rechazo: '  Monto incorrecto  ',
      tiene_comprobante: true,
    });
    expect(order).toMatchObject({
      status: 'REFUND_PENDING',
      verificationDueAt: new Date('2026-11-04T03:00:00.000Z'),
      declaredAmount: 20,
      bankOrWallet: 'YAPE',
      rejectionReason: 'Monto incorrecto',
      hasProof: true,
    });
  });
});

describe('toMyTicket', () => {
  const dto: MyTicketDto = {
    orden_id: 'o-1',
    rifa_id: 'r-1',
    titulo_rifa: 'Smart TV',
    numeros: [23, 7],
    estado: 'PENDING',
    monto_total: 20.5,
    vence_en: '2026-11-03T15:15:00.000Z',
  };

  it('maps one item of GET /mis-boletos', () => {
    expect(toMyTicket(dto)).toEqual({
      orderId: 'o-1',
      raffleId: 'r-1',
      raffleTitle: 'Smart TV',
      numbers: [23, 7],
      status: 'PENDING',
      totalAmount: 20.5,
      expiresAt: new Date('2026-11-03T15:15:00.000Z'),
    });
  });

  it('reads an unreadable vence_en as no deadline', () => {
    expect(toMyTicket({ ...dto, vence_en: 'not a date' }).expiresAt).toBeNull();
  });

  it('keeps a blank title blank: the API sends "" for a raffle it no longer finds', () => {
    expect(toMyTicket({ ...dto, titulo_rifa: '' }).raffleTitle).toBe('');
  });
});


import {
  toAdminPaymentAccount,
  toAdminRefund,
  toPaymentAccountChange,
  toPendingProof,
} from './api.mappers';

describe('Admin queue and account mappers', () => {
  it('maps pending proof with operation number', () => {
    const proof = toPendingProof({
      orden_id: 'ord-1',
      rifa_id: 'rif-1',
      estado: 'PENDING_VERIFICATION',
      numeros: [1, 2],
      monto_total: 20,
      vence_en: '2026-11-03T16:00:00.000Z',
      verificacion_vence_en: '2026-11-03T17:00:00.000Z',
      monto_declarado: 20,
      banco_o_billetera: 'YAPE',
      motivo_rechazo: null,
      tiene_comprobante: true,
      creada_en: '2026-11-03T15:00:00.000Z',
      numero_operacion: 'OP-999',
    });
    expect(proof.id).toBe('ord-1');
    expect(proof.operationNumber).toBe('OP-999');
    expect(proof.raffleTitle).toBeNull();
    expect(proof.buyer).toBeNull();
  });

  it('maps pending proof with raffle title and buyer info', () => {
    const proof = toPendingProof({
      orden_id: 'ord-2',
      rifa_id: 'rif-1',
      estado: 'PENDING_VERIFICATION',
      numeros: [5],
      monto_total: 10,
      vence_en: '2026-11-03T16:00:00.000Z',
      verificacion_vence_en: '2026-11-03T17:00:00.000Z',
      monto_declarado: 10,
      banco_o_billetera: 'YAPE',
      motivo_rechazo: null,
      tiene_comprobante: true,
      creada_en: '2026-11-03T15:00:00.000Z',
      numero_operacion: 'OP-777',
      titulo_rifa: 'Rifa Moto',
      comprador: {
        id: 'buyer-1',
        nombre: 'Maria Torres',
        documento: '87654321',
        celular: '+51 999888777',
        email: 'maria@example.com',
      },
    });
    expect(proof.raffleTitle).toBe('Rifa Moto');
    expect(proof.buyer).toEqual({
      id: 'buyer-1',
      name: 'Maria Torres',
      document: '87654321',
      phone: '+51 999888777',
      email: 'maria@example.com',
    });
    expect(proof.totalAmount).toBe(10);
  });

  it('maps admin refund', () => {
    const refund = toAdminRefund({
      reembolso_id: 'ref-1',
      orden_id: 'ord-1',
      rifa_id: 'rif-1',
      pago_id: 'pay-1',
      monto: 30,
      motivo: 'Comprobante rechazado',
      estado: 'PENDING',
      creado_en: '2026-11-03T15:00:00.000Z',
    });
    expect(refund.refundId).toBe('ref-1');
    expect(refund.amount).toBe(30);
    expect(refund.createdAt).toEqual(new Date('2026-11-03T15:00:00.000Z'));
  });

  it('maps admin payment account and changes', () => {
    const account = toAdminPaymentAccount({
      cuenta_id: 'acc-1',
      metodo: 'BCP',
      titular: 'Rifas SAC',
      numero: '19112345678',
      cci: '00219112345678901234',
      version: 2,
      orden: 1,
      activa: true,
      creada_en: '2026-11-01T10:00:00.000Z',
      actualizada_en: '2026-11-02T10:00:00.000Z',
      creada_por: 'admin-1',
      actualizada_por: 'admin-2',
    });
    expect(account.id).toBe('acc-1');
    expect(account.active).toBe(true);
    expect(account.label).toBe('BCP');

    const change = toPaymentAccountChange({
      solicitud_id: 'chg-1',
      tipo: 'CREATE',
      cuenta_id: 'acc-1',
      estado: 'PENDING',
      propuesta: {
        metodo: 'PLIN',
        titular: 'Juan Perez',
        numero: '987654321',
        cci: null,
        orden: 2,
      },
      anterior: null,
      propuesta_por: 'admin-1',
      propuesta_en: '2026-11-03T12:00:00.000Z',
      decidida_por: null,
      decidida_en: null,
    });
    expect(change.id).toBe('chg-1');
    expect(change.proposed?.method).toBe('PLIN');
    expect(change.proposedBy).toBe('admin-1');
    expect(change.decidedBy).toBeNull();
  });

  describe('toRaffleOrderWithBuyer', () => {
    it('maps buyer with spanish keys', () => {
      const mapped = toRaffleOrderWithBuyer({
        orden_id: 'ord-1',
        rifa_id: 'rifa-1',
        estado: 'PENDING_VERIFICATION',
        numeros: [1, 2],
        monto_total: 20,
        monto_declarado: 20,
        banco_o_billetera: 'PLIN',
        numero_operacion: '123456',
        tiene_comprobante: true,
        creada_en: '2026-11-04T20:00:00.000Z',
        verificada_en: null,
        comprador: {
          id: 'user-1',
          nombre: 'Juan Perez',
          documento: '12345678',
          celular: '999888777',
          email: 'juan@test.com',
        },
      });
      expect(mapped.buyer?.name).toBe('Juan Perez');
      expect(mapped.buyer?.document).toBe('12345678');
      expect(mapped.buyer?.phone).toBe('999888777');
      expect(mapped.buyer?.email).toBe('juan@test.com');
    });

    it('falls back to english keys when present', () => {
      const mapped = toRaffleOrderWithBuyer({
        orden_id: 'ord-2',
        rifa_id: 'rifa-1',
        estado: 'PAID',
        numeros: [5],
        monto_total: 10,
        monto_declarado: 10,
        banco_o_billetera: 'YAPE',
        numero_operacion: '654321',
        tiene_comprobante: true,
        creada_en: '2026-11-04T20:00:00.000Z',
        verificada_en: null,
        comprador: {
          id: 'user-2',
          name: 'Hector Lopez',
          document: '42636253',
          phone: '987654321',
          email: null,
        },
      });
      expect(mapped.buyer?.name).toBe('Hector Lopez');
      expect(mapped.buyer?.document).toBe('42636253');
      expect(mapped.buyer?.phone).toBe('987654321');
      expect(mapped.buyer?.email).toBeNull();
    });
  });
});

describe('toOperatorAlert', () => {
  it('maps motivo to reason when present', () => {
    const alert = toOperatorAlert({
      alerta_id: 'alt-1',
      tipo: 'NOTIFICATION_FAILED',
      rifa_id: 'rif-1',
      titulo_rifa: 'Rifa Moto',
      orden_id: 'ord-1',
      cuenta_pago_id: null,
      monto: 25,
      motivo: 'El comprador no tiene correo electrónico registrado',
      creada_en: '2026-11-05T12:00:00.000Z',
    });

    expect(alert.id).toBe('alt-1');
    expect(alert.type).toBe('NOTIFICATION_FAILED');
    expect(alert.reason).toBe('El comprador no tiene correo electrónico registrado');
  });

  it('defaults reason to null when motivo is missing or undefined', () => {
    const alert = toOperatorAlert({
      alerta_id: 'alt-2',
      tipo: 'DRAW_BLOCKED',
      rifa_id: 'rif-1',
      titulo_rifa: 'Rifa Moto',
      orden_id: null,
      cuenta_pago_id: null,
      monto: null,
      creada_en: '2026-11-05T12:00:00.000Z',
    });

    expect(alert.reason).toBeNull();
  });
});