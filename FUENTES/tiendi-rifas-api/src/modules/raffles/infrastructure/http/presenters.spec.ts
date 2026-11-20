import {
  BankOrWallet,
  DrawEffect,
  DrawMode,
  DrawSpeed,
  WinnerExclusionMode,
  OperatorAlert,
  OperatorAlertType,
  OrderStatus,
  PaymentAccount,
  PaymentAccountChange,
  PaymentAccountChangeKind,
  RaffleStatus,
  TicketOrder,
} from '../../domain';
import { RaffleQueries } from '../../application/queries/raffle-queries';
import {
  adminPaymentAccount,
  adminRaffleDetail,
  liveData,
  liveDrawSession,
  liveDrawSessionOf,
  myTicket,
  alert as presentAlert,
  order as presentOrder,
  paymentAccountChange as presentChange,
  pendingProof,
  orderWithServerTime,
  publicPaymentAccount,
  raffleSummary,
  verification,
} from './presenters';

describe('raffleSummary presenter (spec §11)', () => {
  const summary = {
    id: 'raffle-1',
    title: 'Rifa Auto',
    prize: 'Un auto',
    ticketPrice: 10,
    numberMin: 1,
    numberMax: 100,
    winningAttempt: 3,
    drawEffect: DrawEffect.TOMBOLA,
    drawMode: DrawMode.MANUAL,
    drawDurationSec: 5,
    drawSpeed: DrawSpeed.SLOW,
    prizeDescription: 'Auto sedan 0km',
    prizeImages: ['https://example.com/auto.jpg'],
    prizes: [
      {
        id: 'p-1',
        position: 1,
        title: 'Un auto',
        description: 'Auto sedan 0km',
        images: ['https://example.com/auto.jpg'],
      },
      { id: 'p-2', position: 2, title: 'Una moto', description: null, images: [] },
    ],
    winnerExclusionMode: WinnerExclusionMode.BUYER,
    status: RaffleStatus.ACTIVE,
    salesCloseAt: '2026-11-10T18:00:00.000Z',
    drawAt: '2026-11-11T18:00:00.000Z',
    authorizationResolution: 'RD-123-2026',
    ticketsSold: 12,
    ticketsReserved: 3,
    ticketsAvailable: 84,
    liveDrawInProgress: false,
    winners: [],
  };

  it('speaks the snake_case Spanish contract, counts and resolution included', () => {
    expect(raffleSummary(summary)).toEqual({
      rifa_id: 'raffle-1',
      titulo: 'Rifa Auto',
      premio: 'Un auto',
      precio_boleto: 10,
      numero_min: 1,
      numero_max: 100,
      intento_ganador: 3,
      efecto_sorteo: DrawEffect.TOMBOLA,
      modalidad_sorteo: DrawMode.MANUAL,
      duracion_efecto_seg: 5,
      velocidad_efecto: DrawSpeed.SLOW,
      descripcion_premio: 'Auto sedan 0km',
      imagenes_premio: ['https://example.com/auto.jpg'],
      premios: [
        {
          posicion: 1,
          titulo: 'Un auto',
          descripcion: 'Auto sedan 0km',
          imagenes: ['https://example.com/auto.jpg'],
        },
        { posicion: 2, titulo: 'Una moto', descripcion: null, imagenes: [] },
      ],
      modo_exclusion_ganador: 'BUYER',
      estado: 'ACTIVE',
      cierre_ventas: '2026-11-10T18:00:00.000Z',
      fecha_sorteo: '2026-11-11T18:00:00.000Z',
      resolucion_autorizacion: 'RD-123-2026',
      boletos_vendidos: 12,
      boletos_reservados: 3,
      boletos_disponibles: 84,
      sorteo_en_vivo: false,
      ganadores: [],
    });
  });

  it('gives the live flag and each prize winner of a drawn raffle (DT-23)', () => {
    const presented = raffleSummary({
      ...summary,
      status: RaffleStatus.DRAWN,
      winners: [
        { position: 1, prizeTitle: 'Un auto', status: 'WON', winningNumber: 7 },
        { position: 2, prizeTitle: 'Una moto', status: 'VOID', winningNumber: null },
      ],
    });

    expect(presented.sorteo_en_vivo).toBe(false);
    expect(presented.ganadores).toEqual([
      { posicion: 1, titulo_premio: 'Un auto', estado: 'WON', numero_ganador: 7 },
      { posicion: 2, titulo_premio: 'Una moto', estado: 'VOID', numero_ganador: null },
    ]);
  });

  it('gives the operator every winner with the buyer alias and the live session', () => {
    const presented = adminRaffleDetail({
      ...summary,
      status: RaffleStatus.DRAWN,
      liveDrawInProgress: true,
      refusedDraw: null,
      liveSession: {
        step: 2,
        totalSteps: 6,
        startedAt: '2026-11-11T18:01:00.000Z',
        updatedAt: '2026-11-11T18:02:00.000Z',
        finishedAt: null,
        conductedBy: { name: 'Carmen López' },
      },
      drawExecutedBy: { kind: 'ADMIN', name: 'Carmen López' },
      adminWinners: [
        { position: 1, prizeTitle: 'Un auto', status: 'WON', winningNumber: 7, buyerAlias: 'Juan Perez' },
      ],
    });

    expect(presented.sorteo_en_vivo).toBe(true);
    expect(presented.sesion_en_vivo).toEqual({
      paso: 2,
      total_pasos: 6,
      iniciada_en: '2026-11-11T18:01:00.000Z',
      actualizada_en: '2026-11-11T18:02:00.000Z',
      finalizada_en: null,
      conducido_por: { nombre: 'Carmen López' },
    });
    expect(presented.ejecutado_por).toEqual({ tipo: 'ADMIN', nombre: 'Carmen López' });
    expect(presented.ganadores).toEqual([
      {
        posicion: 1,
        titulo_premio: 'Un auto',
        estado: 'WON',
        numero_ganador: 7,
        alias_comprador: 'Juan Perez',
      },
    ]);
  });
});

describe('live draw session presenter (DT-23)', () => {
  it('speaks the Spanish contract, from the domain session or its view', () => {
    const expected = {
      paso: 1,
      total_pasos: 3,
      iniciada_en: '2026-11-11T18:01:00.000Z',
      actualizada_en: '2026-11-11T18:01:05.000Z',
      finalizada_en: null,
      conducido_por: null,
    };
    expect(
      liveDrawSession({
        step: 1,
        totalSteps: 3,
        startedAt: new Date('2026-11-11T18:01:00.000Z'),
        updatedAt: new Date('2026-11-11T18:01:05.000Z'),
        finishedAt: null,
      }),
    ).toEqual(expected);
    expect(liveDrawSession(null)).toBeNull();
  });

  it('adds sesion_en_vivo to the live data, null without a session', () => {
    const base = {
      raffleId: 'r-1',
      prizes: [],
      buyerGroups: [],
      soldTicketBuyers: {},
      result: null,
    };
    expect(liveData({ ...base, liveSession: null } as any).sesion_en_vivo).toBeNull();
    expect(
      liveData({
        ...base,
        liveSession: {
          step: 0,
          totalSteps: 2,
          startedAt: '2026-11-11T18:01:00.000Z',
          updatedAt: '2026-11-11T18:01:00.000Z',
          finishedAt: null,
        },
      } as any).sesion_en_vivo,
    ).toEqual({
      paso: 0,
      total_pasos: 2,
      iniciada_en: '2026-11-11T18:01:00.000Z',
      actualizada_en: '2026-11-11T18:01:00.000Z',
      finalizada_en: null,
      conducido_por: null,
    });
  });

  it('names who conducted the session and nothing else about them', () => {
    const presented = liveDrawSession({
      step: 0,
      totalSteps: 2,
      startedAt: '2026-11-11T18:01:00.000Z',
      updatedAt: '2026-11-11T18:01:00.000Z',
      finishedAt: null,
      conductedBy: { name: 'Carmen López' },
      // Whatever else reaches the presenter never leaves it.
      startedBy: 'admin-uuid-1',
      email: 'carmen@tiendi.pe',
    } as any);

    expect(presented?.conducido_por).toEqual({ nombre: 'Carmen López' });
    const json = JSON.stringify(presented);
    expect(json).not.toContain('admin-uuid-1');
    expect(json).not.toContain('carmen@tiendi.pe');
  });

  it('keeps the session state of the operator actions free of the operator id', () => {
    const presented = liveDrawSessionOf({
      step: 1,
      totalSteps: 2,
      startedAt: new Date('2026-11-11T18:01:00.000Z'),
      updatedAt: new Date('2026-11-11T18:01:00.000Z'),
      finishedAt: null,
      startedBy: 'admin-uuid-1',
    } as any);

    expect(JSON.stringify(presented)).not.toContain('admin-uuid-1');
  });

  describe('resultado.ejecutado_por', () => {
    const resultWith = (executedBy: unknown) =>
      liveData({
        raffleId: 'r-1',
        prizes: [],
        buyerGroups: [],
        soldTicketBuyers: {},
        liveSession: null,
        result: {
          extractions: [],
          winners: [],
          executedAt: '2026-11-11T18:01:00.000Z',
          executedBy,
        },
      } as any).resultado;

    it('names the admin who executed the draw', () => {
      expect(resultWith({ kind: 'ADMIN', name: 'Carmen López' })?.ejecutado_por).toEqual({
        tipo: 'ADMIN',
        nombre: 'Carmen López',
      });
    });

    it('gives tipo SISTEMA and nombre null for a draw run by the job', () => {
      expect(resultWith({ kind: 'SYSTEM', name: null })?.ejecutado_por).toEqual({
        tipo: 'SISTEMA',
        nombre: null,
      });
    });

    it('gives null for a legacy draw that recorded no executor', () => {
      expect(resultWith(null)?.ejecutado_por).toBeNull();
    });

    it('gives the admin detail a null ejecutado_por for a legacy draw', () => {
      expect(adminRaffleDetail({ prizes: [], drawExecutedBy: null } as any).ejecutado_por).toBeNull();
    });
  });
});

describe('liveData and verification presenters', () => {
  it('maps snake_case extractions and drawEffect in liveData', () => {
    const live = {
      raffleId: 'r-1',
      title: 'Rifa Moto',
      status: RaffleStatus.DRAWN,
      numberMin: 1,
      numberMax: 30,
      winningAttempt: 2,
      drawEffect: DrawEffect.SLOT_MACHINE,
      drawMode: DrawMode.MANUAL,
      drawDurationSec: 6,
      drawSpeed: DrawSpeed.FAST,
      prizes: [{ id: 'p-1', position: 1, title: 'Moto', description: null, images: [] }],
      winnerExclusionMode: WinnerExclusionMode.TICKET_ONLY,
      drawConfigHash: 'config-hash',
      commitmentHash: 'comm-hash',
      drandChainHash: 'chain-hash',
      drandRound: '12345',
      salesCloseAt: '2026-11-05T09:00:00.000Z',
      drawAt: '2026-11-05T10:00:00.000Z',
      soldListHash: 'list-hash',
      seedRevealed: 'seed-hex',
      soldNumbers: [1, 2, 3],
      result: {
        winningNumber: 2,
        winnerIndex: 1,
        digestHex: 'digest-hex-2',
        drandRandomness: 'rand-hex',
        winningAttempt: 2,
        extractions: [
          { attempt: 1, number: 3, index: 2, digestHex: 'd1', isWinner: false },
          { attempt: 2, number: 2, index: 1, digestHex: 'd2', isWinner: true },
        ],
        executedAt: '2026-11-05T10:00:05.000Z',
        algorithmVersion: 'v1',
        winners: [
          {
            id: 'w-1',
            prizeId: 'p-1',
            position: 1,
            status: 'WON',
            ticketId: 't-2',
            winningNumber: 2,
            winnerIndex: 1,
            digestHex: 'd2',
            poolSize: 3,
            excludedTickets: [2],
            extractions: [{ attempt: 1, number: 2, index: 1, digestHex: 'd2', isWinner: true }],
          },
        ],
      },
    };

    const presented = liveData(live as any);
    expect(presented.premios).toEqual([
      { posicion: 1, titulo: 'Moto', descripcion: null, imagenes: [] },
    ]);
    expect(presented.modo_exclusion_ganador).toBe('TICKET_ONLY');
    expect(presented.hash_configuracion).toBe('config-hash');
    expect(presented.resultado?.ganadores).toEqual([
      {
        posicion: 1,
        estado: 'WON',
        numero_ganador: 2,
        indice_ganador: 1,
        digest_hex: 'd2',
        boletos_en_juego: 3,
        excluidos: [2],
        extracciones: [{ intento: 1, numero: 2, indice: 1, digest_hex: 'd2', es_ganador: true }],
      },
    ]);
    expect(presented.numero_min).toBe(1);
    expect(presented.numero_max).toBe(30);
    expect(presented.intento_ganador).toBe(2);
    expect(presented.efecto_sorteo).toBe(DrawEffect.SLOT_MACHINE);
    expect(presented.modalidad_sorteo).toBe(DrawMode.MANUAL);
    expect(presented.duracion_efecto_seg).toBe(6);
    expect(presented.velocidad_efecto).toBe(DrawSpeed.FAST);
    expect(presented.resultado?.extracciones).toEqual([
      { intento: 1, numero: 3, indice: 2, digest_hex: 'd1', es_ganador: false },
      { intento: 2, numero: 2, indice: 1, digest_hex: 'd2', es_ganador: true },
    ]);
  });

  it('maps snake_case extractions and winningAttempt in verification', () => {
    const verif = {
      raffleId: 'r-1',
      title: 'Rifa Moto',
      prize: 'Moto 150cc',
      algorithmVersion: 'v1',
      authorizationResolution: 'RD-001',
      status: 'DRAWN',
      commitmentHash: 'comm-hash',
      seedRevealed: 'seed-hex',
      drandChainHash: 'chain-hash',
      drandRound: '12345',
      drawAt: '2026-11-05T10:00:00.000Z',
      salesCloseAt: '2026-11-05T09:00:00.000Z',
      drandRandomness: 'rand-hex',
      soldListHash: 'list-hash',
      soldListVerified: true,
      soldNumbers: [1, 2, 3],
      winnerIndex: 1,
      winningNumber: 2,
      digestHex: 'digest-hex-2',
      winningAttempt: 2,
      extractions: [
        { attempt: 1, number: 3, index: 2, digestHex: 'd1', isWinner: false },
        { attempt: 2, number: 2, index: 1, digestHex: 'd2', isWinner: true },
      ],
      executedAt: '2026-11-05T10:00:05.000Z',
      prizes: [{ position: 1, title: 'Moto 150cc', description: null, images: [] }],
      winnerExclusionMode: 'BUYER',
      drawConfigHash: 'config-hash',
      drawConfigVerified: true,
      buyerGroups: [[1, 3], [2]],
      winners: [
        {
          position: 1,
          prizeTitle: 'Moto 150cc',
          status: 'WON',
          winningNumber: 2,
          winnerIndex: 1,
          digestHex: 'd2',
          poolSize: 3,
          excludedTickets: [2],
          extractions: [],
        },
      ],
    };

    const presented = verification(verif as any);
    expect(presented.modo_exclusion_ganador).toBe('BUYER');
    expect(presented.hash_configuracion).toBe('config-hash');
    expect(presented.configuracion_verificada).toBe(true);
    expect(presented.grupos_compradores).toEqual([[1, 3], [2]]);
    expect(presented.ganadores[0]).toMatchObject({
      posicion: 1,
      titulo_premio: 'Moto 150cc',
      estado: 'WON',
      numero_ganador: 2,
    });
    expect(presented.intento_ganador).toBe(2);
    expect(presented.extracciones).toHaveLength(2);
    expect(presented.extracciones[0]).toEqual({
      intento: 1,
      numero: 3,
      indice: 2,
      digest_hex: 'd1',
      es_ganador: false,
    });
    expect(presented.extracciones[1]).toEqual({
      intento: 2,
      numero: 2,
      indice: 1,
      digest_hex: 'd2',
      es_ganador: true,
    });
  });
});

describe('payment account presenters (DT-19)', () => {
  const createdAt = new Date('2026-11-03T10:00:00Z');
  const account = PaymentAccount.create(
    'account-1',
    {
      method: BankOrWallet.BCP,
      holderName: 'Rifas Tiendi SAC',
      accountNumber: '19112345678012',
      cci: '00219111234567801255',
      displayOrder: 1,
    },
    'admin-1',
    createdAt,
  );

  it('shows buyers where to pay, with the version their proof names, and nothing about who set it', () => {
    expect(publicPaymentAccount(account)).toEqual({
      cuenta_id: 'account-1',
      metodo: 'BCP',
      titular: 'Rifas Tiendi SAC',
      numero: '19112345678012',
      cci: '00219111234567801255',
      version: 1,
    });
  });

  it('shows operators the state, the order and who last changed it', () => {
    expect(adminPaymentAccount(account.withActive(false, 'admin-2', createdAt))).toEqual({
      cuenta_id: 'account-1',
      metodo: 'BCP',
      titular: 'Rifas Tiendi SAC',
      numero: '19112345678012',
      cci: '00219111234567801255',
      orden: 1,
      activa: false,
      version: 2,
      creada_en: createdAt.toISOString(),
      actualizada_en: createdAt.toISOString(),
      creada_por: 'admin-1',
      actualizada_por: 'admin-2',
    });
  });
});

describe('my ticket presenter (spec §11, RF-06)', () => {
  it('speaks the contract of GET /mis-boletos, with vence_en as on the order', () => {
    expect(
      myTicket({
        orderId: 'order-1',
        raffleId: 'raffle-1',
        raffleTitle: 'Rifa Auto',
        numbers: [7, 8],
        status: OrderStatus.PENDING,
        totalAmount: 10,
        expiresAt: '2026-11-10T10:15:00.000Z',
      }),
    ).toEqual({
      orden_id: 'order-1',
      rifa_id: 'raffle-1',
      titulo_rifa: 'Rifa Auto',
      numeros: [7, 8],
      estado: 'PENDING',
      monto_total: 10,
      vence_en: '2026-11-10T10:15:00.000Z',
    });
  });
});

describe('order with the server time', () => {
  it('adds hora_servidor, the server clock in ISO 8601, to the order', () => {
    const order = new TicketOrder({
      id: 'order-1',
      raffleId: 'raffle-1',
      userId: 'buyer-1',
      numbers: [7],
      totalAmount: 10,
      status: OrderStatus.PENDING,
      expiresAt: new Date('2026-11-03T10:15:00Z'),
    });
    const now = new Date('2026-11-03T10:01:02.003Z');

    expect(orderWithServerTime(RaffleQueries.orderView(order), now)).toEqual({
      ...presentOrder(RaffleQueries.orderView(order)),
      hora_servidor: '2026-11-03T10:01:02.003Z',
    });
  });
});

describe('pendingProof presenter', () => {
  it('includes titulo_rifa and comprador along with order and numero_operacion', () => {
    const order = new TicketOrder({
      id: 'order-1',
      raffleId: 'raffle-1',
      userId: 'buyer-1',
      numbers: [7],
      totalAmount: 10,
      status: OrderStatus.PENDING_VERIFICATION,
      expiresAt: new Date('2026-11-03T10:15:00Z'),
      operationNumber: 'OP-999',
    });

    const presented = pendingProof({
      ...RaffleQueries.orderView(order),
      operationNumber: 'OP-999',
      raffleTitle: 'Rifa Auto',
      buyer: {
        id: 'buyer-1',
        name: 'Carlos Gomez',
        document: '12345678',
        phone: '+51 987654321',
        email: 'carlos@example.com',
        buyerCode: 'CARLOS-GOMEZ',
      },
    });

    expect(presented).toMatchObject({
      orden_id: 'order-1',
      numero_operacion: 'OP-999',
      titulo_rifa: 'Rifa Auto',
      comprador: {
        id: 'buyer-1',
        nombre: 'Carlos Gomez',
        documento: '12345678',
        celular: '+51 987654321',
        email: 'carlos@example.com',
        codigo_comprador: 'CARLOS-GOMEZ',
      },
    });
  });
});

describe('the account a buyer paid to (DT-19)', () => {
  const order = (paidToAccount: TicketOrder['paidToAccount']) =>
    new TicketOrder({
      id: 'order-1',
      raffleId: 'raffle-1',
      userId: 'buyer-1',
      numbers: [7],
      totalAmount: 10,
      status: OrderStatus.PENDING_VERIFICATION,
      expiresAt: new Date('2026-11-03T10:15:00Z'),
      paidToAccount,
    });

  it('shows the copy kept on the order as cuenta_destino', () => {
    const paidTo = {
      accountId: 'account-1',
      method: BankOrWallet.BCP,
      holderName: 'Rifas Tiendi SAC',
      accountNumber: '19112345678012',
      cci: '00219111234567801255',
      version: 3,
    };

    expect(presentOrder(RaffleQueries.orderView(order(paidTo))).cuenta_destino).toEqual({
      cuenta_id: 'account-1',
      metodo: 'BCP',
      titular: 'Rifas Tiendi SAC',
      numero: '19112345678012',
      cci: '00219111234567801255',
      version: 3,
    });
  });

  it('is null before any proof', () => {
    expect(presentOrder(RaffleQueries.orderView(order(null))).cuenta_destino).toBeNull();
  });
});

describe('payment account change presenter (DT-19, four eyes)', () => {
  it('shows what was proposed, by whom, and what was there before', () => {
    const change = PaymentAccountChange.propose({
      id: 'change-1',
      kind: PaymentAccountChangeKind.UPDATE,
      accountId: 'account-1',
      proposed: { method: BankOrWallet.YAPE, holderName: 'Otra', accountNumber: '912345678', cci: null, displayOrder: 1 },
      before: { method: BankOrWallet.YAPE, holderName: 'Rifas', accountNumber: '987654321', cci: null, displayOrder: 1 },
      proposedBy: 'admin-1',
      proposedAt: new Date('2026-11-03T10:00:00Z'),
    });

    expect(presentChange(change)).toEqual({
      solicitud_id: 'change-1',
      tipo: 'UPDATE',
      cuenta_id: 'account-1',
      estado: 'PENDING',
      propuesta: { metodo: 'YAPE', titular: 'Otra', numero: '912345678', cci: null, orden: 1 },
      anterior: { metodo: 'YAPE', titular: 'Rifas', numero: '987654321', cci: null, orden: 1 },
      propuesta_por: 'admin-1',
      propuesta_en: '2026-11-03T10:00:00.000Z',
      decidida_por: null,
      decidida_en: null,
    });
  });
});

describe('operator alert presenter', () => {
  it('names the payment account of a payment account alert, with no raffle', () => {
    const alert = new OperatorAlert({
      id: 'alert-1',
      type: OperatorAlertType.PAYMENT_ACCOUNT_CHANGE,
      raffleId: null,
      raffleTitle: null,
      orderId: null,
      amount: null,
      paymentAccountId: 'account-1',
      createdAt: new Date('2026-11-03T10:00:00Z'),
    });

    expect(presentAlert(alert)).toMatchObject({
      tipo: 'PAYMENT_ACCOUNT_CHANGE',
      rifa_id: null,
      cuenta_pago_id: 'account-1',
    });
  });

  it('serializes motivo from alert.reason when present', () => {
    const alert = new OperatorAlert({
      id: 'alert-2',
      type: OperatorAlertType.NOTIFICATION_FAILED,
      raffleId: 'r-1',
      raffleTitle: 'Rifa Moto',
      orderId: 'o-1',
      amount: 50,
      reason: 'El comprador no tiene correo electrónico registrado',
      createdAt: new Date('2026-11-05T10:00:00Z'),
    });

    expect(presentAlert(alert)).toMatchObject({
      motivo: 'El comprador no tiene correo electrónico registrado',
    });
  });

  it('serializes motivo as null when alert.reason is null', () => {
    const alert = new OperatorAlert({
      id: 'alert-3',
      type: OperatorAlertType.LATE_PAYMENT_CLAIM,
      raffleId: 'r-1',
      raffleTitle: 'Rifa Moto',
      orderId: 'o-1',
      amount: 50,
      reason: null,
      createdAt: new Date('2026-11-05T10:00:00Z'),
    });

    expect(presentAlert(alert)).toMatchObject({
      motivo: null,
    });
  });
});
