import { createHash, randomUUID } from 'crypto';
import { roundAt } from '@kanoso/raffle-draw';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import {
  CloseSalesUseCase,
  ExecuteDrawUseCase,
  FakeRandomnessBeacon,
  ReleaseExpiredReservationsUseCase,
} from '../src/modules/raffles/application';
import { SystemClock } from '../src/modules/raffles/infrastructure/jobs/system-clock';
import {
  PrismaDrawRepository,
  PrismaRaffleRepository,
  PrismaTicketLedger,
  PrismaTicketRepository,
} from '../src/modules/raffles/infrastructure/persistence';
import { seedVaultFrom } from '../src/modules/raffles/infrastructure/wiring';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);

type Method = 'get' | 'post' | 'patch';

describe('HTTP API (F6, spec §11 and §13)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  const beacon = new FakeRandomnessBeacon();
  let ipCounter = 0;

  /**
   * Each caller its own IP, so only the rate-limit tests share a counter.
   * supertest calls from loopback, the default TRUST_PROXY, so Express reads
   * the client from X-Forwarded-For as it would behind a trusted proxy.
   */
  const freshIp = () => `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
  const http = () => request(app.getHttpServer());
  const call = (method: Method, path: string) => http()[method](path);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // The draw asks drand for its round: the tests answer from a fake.
      .overrideProvider(ExecuteDrawUseCase)
      .useFactory({
        inject: [PrismaRaffleRepository, PrismaTicketRepository, PrismaTicketLedger, PrismaDrawRepository],
        factory: (r, t, l, d) => new ExecuteDrawUseCase(r, t, l, beacon, new SystemClock(), d),
      })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  /** The account every proof is paid to: proposed and approved by two operators (DT-19). */
  let paidToAccountId: string;

  beforeAll(async () => {
    const proposer = (await signIn('admin')).token;
    const approver = (await signIn('admin')).token;
    const proposed = await http()
      .post('/api/admin/cuentas-pago')
      .set(as(proposer))
      .send({ metodo: 'YAPE', titular: 'Rifas Tiendi SAC', numero: `9${String(Date.now()).slice(-8)}` })
      .expect(202);
    await http().post(`/api/admin/cuentas-pago/cambios/${proposed.body.solicitud_id}/aprobar`).set(as(approver)).expect(200);
    paidToAccountId = proposed.body.cuenta_id;
  });

  // ---------------------------------------------------------------- helpers

  /** The access email waits in the outbox (DT-13): its link holds the token. */
  async function tokenFor(email: string): Promise<string> {
    const row = await prisma.notificationOutbox.findFirst({
      where: { type: 'MAGIC_LINK', recipient: email },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) {
      throw new Error(`No link was queued for ${email}`);
    }
    return new URL((row.payload as { link: string }).link).hash.replace('#token=', '');
  }

  const requestLink = (email: string, ip = freshIp()) =>
    http().post('/api/auth/enlace').set('X-Forwarded-For', ip).send({ email });

  async function signIn(role: 'buyer' | 'admin' = 'buyer'): Promise<{ token: string; userId: string; email: string }> {
    const email = `${randomUUID()}@test.local`;
    await requestLink(email).expect(202);
    const res = await http()
      .post('/api/auth/sesion')
      .set('X-Forwarded-For', freshIp())
      .send({ token: await tokenFor(email) })
      .expect(200);
    if (role === 'admin') {
      await prisma.user.update({ where: { email }, data: { role: 'admin' } });
    }
    return { token: res.body.token_acceso, userId: res.body.usuario.usuario_id, email };
  }

  const as = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function moveCloseOfSales(raffleId: string, salesCloseAt: Date) {
    // The schedule is frozen once published: only here is the guard off.
    await prisma.$executeRaw`ALTER TABLE "Raffle" DISABLE TRIGGER trg_raffle_schedule_immutable`;
    try {
      await prisma.raffle.update({ where: { id: raffleId }, data: { salesCloseAt } });
    } finally {
      await prisma.$executeRaw`ALTER TABLE "Raffle" ENABLE TRIGGER trg_raffle_schedule_immutable`;
    }
  }

  async function activeRaffle(admin: string, { numbers = 50, price = 10 } = {}): Promise<string> {
    const created = await http()
      .post('/api/admin/rifas')
      .set(as(admin))
      .send({ titulo: 'Rifa Auto', premio: 'Un auto', precio_boleto: price, numero_min: 1, numero_max: numbers })
      .expect(201);
    const day = 24 * 3600_000;
    await http()
      .post(`/api/admin/rifas/${created.body.rifa_id}/publicar`)
      .set(as(admin))
      .send({
        resolucion_autorizacion: 'RD-123-2026',
        cierre_ventas: new Date(Date.now() + 2 * day).toISOString(),
        fecha_sorteo: new Date(Date.now() + 3 * day).toISOString(),
      })
      .expect(200);
    return created.body.rifa_id;
  }

  function reserve(buyer: string, raffleId: string, numeros: number[], ip = freshIp()) {
    return http().post('/api/reservas').set(as(buyer)).set('X-Forwarded-For', ip).send({ rifa_id: raffleId, numeros });
  }

  function sendProof(buyer: string, orderId: string, monto = 10, file: Buffer = PNG) {
    return http()
      .post(`/api/ordenes/${orderId}/comprobante`)
      .set(as(buyer))
      .set('X-Forwarded-For', freshIp())
      .field('banco_o_billetera', 'YAPE')
      .field('monto_declarado', String(monto))
      .field('numero_operacion', `OP${randomUUID().slice(0, 8)}`)
      .field('cuenta_id', paidToAccountId)
      .field('cuenta_version', '1')
      .attach('archivo', file, 'proof.png');
  }

  async function orderInVerification(admin: string, numbers = [1]) {
    const raffleId = await activeRaffle(admin);
    const buyer = await signIn();
    const reservation = await reserve(buyer.token, raffleId, numbers).expect(201);
    await sendProof(buyer.token, reservation.body.orden_id, 10 * numbers.length).expect(200);
    return { raffleId, buyer, orderId: reservation.body.orden_id as string };
  }

  const opNumber = () => `OP${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

  async function paidOrder(admin: string) {
    const ctx = await orderInVerification(admin);
    await http()
      .post(`/api/admin/ordenes/${ctx.orderId}/aprobar`)
      .set(as(admin))
      .send({ numero_operacion: opNumber(), monto_recibido: 10 })
      .expect(204);
    return ctx;
  }

  /** The reservation lapsed. With `release`, the job also ran. */
  async function lapse(raffleId: string, orderId: string, { release = true } = {}) {
    const past = new Date(Date.now() - 60_000);
    await prisma.ticketOrder.update({ where: { id: orderId }, data: { expiresAt: past } });
    await prisma.ticket.updateMany({ where: { orderId }, data: { reservedUntil: past } });
    if (release) {
      await new ReleaseExpiredReservationsUseCase(
        app.get(PrismaTicketRepository),
        app.get(PrismaTicketLedger),
        new SystemClock(),
      ).execute(raffleId);
    }
  }

  // ------------------------------------------------------------ the format

  describe('error format', () => {
    it('answers every error as { code, message }', async () => {
      const res = await http().get(`/api/rifas/${randomUUID()}`).expect(404);

      expect(res.body).toEqual({ code: 'RAFFLE_NOT_FOUND', message: expect.any(String) });
    });

    it('answers a malformed request with VALIDATION_FAILED and its details', async () => {
      const res = await http().get('/api/rifas/not-a-uuid').expect(400);

      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.details).toEqual([expect.objectContaining({ message: expect.any(String) })]);
    });
  });

  // ---------------------------------------------------------- magic link (D4)

  describe('access by magic link (D4)', () => {
    it('queues the link email, creates no user until the link is used, and opens a session once', async () => {
      const email = `${randomUUID()}@test.local`;
      await requestLink(email).expect(202);
      expect(await prisma.user.count({ where: { email } })).toBe(0);
      const token = await tokenFor(email);

      const links = await prisma.authMagicLink.findMany({ where: { email } });
      expect(links).toHaveLength(1);
      expect(links[0].tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
      expect(JSON.stringify(links)).not.toContain(token);

      const first = await http().post('/api/auth/sesion').set('X-Forwarded-For', freshIp()).send({ token }).expect(200);
      expect(first.body).toEqual({
        token_acceso: expect.any(String),
        vence_en: expect.any(String),
        usuario: { usuario_id: expect.any(String), email, rol: 'buyer' },
      });
      expect(await prisma.user.count({ where: { email } })).toBe(1);

      const again = await http().post('/api/auth/sesion').set('X-Forwarded-For', freshIp()).send({ token }).expect(401);
      expect(again.body.code).toBe('MAGIC_LINK_INVALID');
    });

    it('refuses an expired link', async () => {
      const email = `${randomUUID()}@test.local`;
      await requestLink(email).expect(202);
      await prisma.authMagicLink.updateMany({ where: { email }, data: { expiresAt: new Date(Date.now() - 1000) } });

      await http()
        .post('/api/auth/sesion')
        .set('X-Forwarded-For', freshIp())
        .send({ token: await tokenFor(email) })
        .expect(401);
    });

    it('answers 202 over the per-address cap too, and queues no more links', async () => {
      const email = `${randomUUID()}@test.local`;
      for (let i = 0; i < 4; i++) {
        await requestLink(email).expect(202);
      }

      expect(await prisma.authMagicLink.count({ where: { email } })).toBe(3);
      expect(await prisma.notificationOutbox.count({ where: { type: 'MAGIC_LINK', recipient: email } })).toBe(3);
    });

    it('limits the link requests per client IP', async () => {
      const ip = '203.0.113.7';
      const statuses: number[] = [];
      for (let i = 0; i < 6; i++) {
        statuses.push((await requestLink(`${randomUUID()}@test.local`, ip)).status);
      }

      expect(statuses).toEqual([202, 202, 202, 202, 202, 429]);
    });

    it('closes the session on logout', async () => {
      const { token, email } = await signIn();
      const me = await http().get('/api/auth/yo').set(as(token)).expect(200);
      expect(me.body).toEqual({ usuario_id: expect.any(String), email, rol: 'buyer' });

      await http().post('/api/auth/salir').set(as(token)).expect(204);

      await http().get('/api/auth/yo').set(as(token)).expect(401);
    });

    it('refuses a forged or missing token', async () => {
      await http().get('/api/mis-boletos').expect(401);
      await http().get('/api/mis-boletos').set(as('not.a.jwt')).expect(401);
    });
  });

  // ------------------------------------------------------- authorization

  describe('authorization matrix', () => {
    const id = randomUUID();
    const adminRoutes: [Method, string][] = [
      ['get', '/api/admin/rifas'],
      ['get', `/api/admin/rifas/${id}`],
      ['post', '/api/admin/rifas'],
      ['post', `/api/admin/rifas/${id}/publicar`],
      ['get', `/api/admin/rifas/${id}/ventas`],
      ['get', '/api/admin/comprobantes'],
      ['get', `/api/admin/rifas/${id}/comprobantes`],
      ['post', `/api/admin/rifas/${id}/sorteo`],
      ['post', `/api/admin/rifas/${id}/cancelar-lista-alterada`],
      ['get', '/api/admin/alertas'],
      ['post', `/api/admin/alertas/${id}/leida`],
      ['get', '/api/admin/pagos-tardios'],
      ['post', `/api/admin/ordenes/${id}/pago-tardio/confirmar`],
      ['post', `/api/admin/ordenes/${id}/pago-tardio/descartar`],
      ['post', `/api/admin/ordenes/${id}/aprobar`],
      ['get', '/api/admin/pagos/colisiones'],
      ['post', `/api/admin/ordenes/${id}/rechazar`],
      ['post', `/api/admin/ordenes/${id}/transferencia-extra`],
      ['get', '/api/admin/reembolsos'],
      ['post', `/api/admin/reembolsos/${id}/completar`],
      ['post', `/api/admin/notificaciones/${id}/reencolar`],
      ['get', '/api/admin/cuentas-pago'],
      ['post', '/api/admin/cuentas-pago'],
      ['patch', `/api/admin/cuentas-pago/${id}`],
      ['post', `/api/admin/cuentas-pago/${id}/desactivar`],
      ['post', `/api/admin/cuentas-pago/${id}/activar`],
      ['get', '/api/admin/cuentas-pago/cambios'],
      ['post', `/api/admin/cuentas-pago/cambios/${id}/aprobar`],
      ['post', `/api/admin/cuentas-pago/cambios/${id}/rechazar`],
      ['post', `/api/admin/cuentas-pago/cambios/${id}/cancelar`],
    ];
    const buyerRoutes: [Method, string][] = [
      ['post', '/api/reservas'],
      ['post', `/api/ordenes/${id}/comprobante`],
      ['post', `/api/ordenes/${id}/pago-tardio`],
      ['get', `/api/ordenes/${id}`],
      ['get', `/api/ordenes/${id}/comprobante`],
      ['get', '/api/mis-boletos'],
    ];
    let buyer: string;
    let admin: string;

    beforeAll(async () => {
      buyer = (await signIn()).token;
      admin = (await signIn('admin')).token;
    });

    it.each(adminRoutes)('%s %s refuses an anonymous caller with 401', async (method, path) => {
      expect((await call(method, path).send({})).status).toBe(401);
    });

    it.each(adminRoutes)('%s %s refuses a buyer with 403', async (method, path) => {
      expect((await call(method, path).set(as(buyer)).send({})).status).toBe(403);
    });

    it.each(adminRoutes)('%s %s lets an operator through the guards', async (method, path) => {
      const res = await call(method, path).set(as(admin)).send({});
      expect([401, 403]).not.toContain(res.status);
    });

    it.each(buyerRoutes)('%s %s refuses an anonymous caller with 401', async (method, path) => {
      expect((await call(method, path).send({})).status).toBe(401);
    });

    it("answers another buyer's order exactly as a missing one, on every buyer route", async () => {
      const { orderId } = await orderInVerification(admin);
      const stranger = (await signIn()).token;
      const missing = randomUUID();
      const same = async (path: (id: string) => string) => {
        const theirs = await http().get(path(orderId)).set(as(stranger));
        const none = await http().get(path(missing)).set(as(stranger));
        expect(theirs.status).toBe(404);
        expect(theirs.body).toEqual({ ...none.body, message: none.body.message.replace(missing, orderId) });
      };

      await same((o) => `/api/ordenes/${o}`);
      await same((o) => `/api/ordenes/${o}/comprobante`);
      const proof = await sendProof(stranger, orderId);
      expect(proof.status).toBe(404);
      expect(proof.body.code).toBe('ORDER_NOT_FOUND');
      const mine = await http().get('/api/mis-boletos').set(as(stranger)).expect(200);
      expect(mine.body).toEqual([]);
    });

    it('takes the operator from the session: a body field cannot name another', async () => {
      const { orderId } = await orderInVerification(admin);

      const res = await http()
        .post(`/api/admin/ordenes/${orderId}/aprobar`)
        .set(as(admin))
        .send({ numero_operacion: opNumber(), monto_recibido: 10, operatorId: 'someone-else' })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });
  });

  // ------------------------------------------------------------- public

  describe('public raffle routes', () => {
    it('lists active raffles and pages the grid, cacheable for 3 s', async () => {
      const admin = (await signIn('admin')).token;
      const raffleId = await activeRaffle(admin);

      const list = await http().get('/api/rifas').expect(200);
      expect(list.body).toContainEqual(
        expect.objectContaining({ rifa_id: raffleId, titulo: 'Rifa Auto', precio_boleto: 10, estado: 'ACTIVE' }),
      );

      const page = await http().get(`/api/rifas/${raffleId}?pagina=2&tamano=42`).expect(200);
      expect(page.headers['cache-control']).toBe('public, max-age=3');
      expect(page.body.grilla).toMatchObject({ pagina: 2, tamano: 42, total: 50, paginas: 2 });
      expect(page.body.grilla.numeros.map((n: { numero: number }) => n.numero)).toEqual(
        Array.from({ length: 8 }, (_, i) => 43 + i),
      );
      expect(page.body.grilla.numeros[0]).toEqual({ numero: 43, estado: 'AVAILABLE' });
    });

    it('shows the sales progress and the resolution of each active raffle (RF-01)', async () => {
      const admin = (await signIn('admin')).token;
      const { raffleId, buyer } = await paidOrder(admin);
      const other = await signIn();
      await reserve(other.token, raffleId, [2, 3]).expect(201);

      const list = await http().get('/api/rifas').expect(200);

      const mine = list.body.find((r: { rifa_id: string }) => r.rifa_id === raffleId);
      expect(mine).toMatchObject({
        resolucion_autorizacion: 'RD-123-2026',
        boletos_vendidos: 1,
        boletos_reservados: 2,
        boletos_disponibles: 47,
      });
      expect(Object.keys(mine).sort()).toEqual(
        [
          'rifa_id', 'titulo', 'premio', 'precio_boleto', 'numero_min', 'numero_max', 'estado',
          'cierre_ventas', 'fecha_sorteo', 'resolucion_autorizacion',
          'boletos_vendidos', 'boletos_reservados', 'boletos_disponibles',
        ].sort(),
      );
      // Counts only: no buyer, order or seed leaves this public route.
      const body = JSON.stringify(list.body);
      for (const secret of [buyer.userId, buyer.email, other.userId, other.email]) {
        expect(body).not.toContain(secret);
      }
      expect(body).not.toMatch(/cipher|orden_id|usuario/i);

      const detail = await http().get(`/api/rifas/${raffleId}`).expect(200);
      expect(detail.body.rifa).toMatchObject({ boletos_vendidos: 1, boletos_reservados: 2, boletos_disponibles: 47 });
    });

    it('hides a draft raffle', async () => {
      const admin = (await signIn('admin')).token;
      const created = await http()
        .post('/api/admin/rifas')
        .set(as(admin))
        .send({ titulo: 'Borrador', premio: 'x', precio_boleto: 1, numero_min: 1, numero_max: 5 })
        .expect(201);

      await http().get(`/api/rifas/${created.body.rifa_id}`).expect(404);
      await http().get(`/api/rifas/${created.body.rifa_id}/en-vivo`).expect(404);

      const adminList = await http().get('/api/admin/rifas').set(as(admin)).expect(200);
      expect(adminList.body.some((r: any) => r.rifa_id === created.body.rifa_id)).toBe(true);

      const adminDetail = await http().get(`/api/admin/rifas/${created.body.rifa_id}`).set(as(admin)).expect(200);
      expect(adminDetail.body.estado).toBe('DRAFT');
      expect(adminDetail.body.titulo).toBe('Borrador');
    });

    it('never shows the seed while sales are open (en-vivo)', async () => {
      const admin = (await signIn('admin')).token;
      const raffleId = await activeRaffle(admin);

      const live = await http().get(`/api/rifas/${raffleId}/en-vivo`).expect(200);

      expect(live.body.semilla_revelada).toBeNull();
      expect(live.body.numeros_vendidos).toBeNull();
      expect(live.body.hash_compromiso).toMatch(/^[0-9a-f]{64}$/);
      expect(live.body.ronda_drand).toMatch(/^\d+$/);
      expect(JSON.stringify(live.body)).not.toMatch(/cipher/i);
    });

    it('answers the verification of an undrawn raffle with 409', async () => {
      const admin = (await signIn('admin')).token;
      const raffleId = await activeRaffle(admin);

      const res = await http().get(`/api/rifas/${raffleId}/verificacion`).expect(409);
      expect(res.body.code).toBe('DRAW_NOT_POSSIBLE');
    });
  });

  // ------------------------------------------------------- reservations

  describe('reservations (§13)', () => {
    it('two buyers reserve the same number at once: only one wins', async () => {
      const admin = (await signIn('admin')).token;
      const raffleId = await activeRaffle(admin);
      const [a, b] = [(await signIn()).token, (await signIn()).token];

      const results = await Promise.all([reserve(a, raffleId, [42]), reserve(b, raffleId, [42])]);

      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(results.find((r) => r.status === 409)?.body.code).toBe('TICKETS_UNAVAILABLE');
      const winner = results.find((r) => r.status === 201)?.body;
      expect(winner).toMatchObject({ estado: 'PENDING', numeros: [42], monto_total: 10, orden_id: expect.any(String) });
    });

    it('a 409 lists only the requested numbers that were not available, sorted and unique', async () => {
      const admin = (await signIn('admin')).token;
      const raffleId = await activeRaffle(admin);
      const [first, second] = [await signIn(), await signIn()];
      await reserve(first.token, raffleId, [7, 9]).expect(201);

      const res = await reserve(second.token, raffleId, [9, 8, 7, 9, 3]).expect(409);

      expect(res.body).toEqual({
        code: 'TICKETS_UNAVAILABLE',
        message: expect.any(String),
        details: { numeros_no_disponibles: [7, 9] },
      });
      const body = JSON.stringify(res.body);
      for (const secret of [first.userId, first.email, 'RESERVED', 'SOLD', 'orden_id']) {
        expect(body).not.toContain(secret);
      }
      // All or nothing: the numbers that were free are still free.
      await reserve(second.token, raffleId, [3, 8]).expect(201);
    });

    it('a reservation from the cutoff before the close is refused', async () => {
      const admin = (await signIn('admin')).token;
      const raffleId = await activeRaffle(admin);
      const buyer = (await signIn()).token;
      // Proofs until 2 h before the close, reservations 15 min before that.
      await moveCloseOfSales(raffleId, new Date(Date.now() + 2 * 3600_000 + 10 * 60_000));

      const res = await reserve(buyer, raffleId, [5]).expect(409);
      expect(res.body.code).toBe('RESERVATIONS_CLOSED');
    });

    it('limits the reservations per client IP', async () => {
      const admin = (await signIn('admin')).token;
      const raffleId = await activeRaffle(admin);
      const buyers: { token: string }[] = [];
      for (let i = 0; i < 11; i++) {
        buyers.push(await signIn());
      }
      const statuses: number[] = [];
      for (let i = 0; i < 11; i++) {
        statuses.push((await reserve(buyers[i].token, raffleId, [1 + i], '198.51.100.9')).status);
      }

      statuses.slice(0, 10).forEach((s) => expect([201, 409]).toContain(s));
      expect(statuses[10]).toBe(429);
    });
  });

  // ------------------------------------------------------------ proofs

  describe('payment proofs (§13)', () => {
    it('a proof inside the deadline moves the order to verification', async () => {
      const admin = (await signIn('admin')).token;
      const { orderId, buyer } = await orderInVerification(admin);

      const order = await http().get(`/api/ordenes/${orderId}`).set(as(buyer.token)).expect(200);
      expect(order.body).toMatchObject({ orden_id: orderId, estado: 'PENDING_VERIFICATION', tiene_comprobante: true });
      expect(order.body.verificacion_vence_en).toEqual(expect.any(String));
    });

    it('the order read and the proof upload carry the server clock as hora_servidor', async () => {
      const admin = (await signIn('admin')).token;
      const raffleId = await activeRaffle(admin);
      const buyer = (await signIn()).token;
      const reservation = await reserve(buyer, raffleId, [9]).expect(201);
      const orderId = reservation.body.orden_id as string;
      const near = (iso: string) => Math.abs(Date.parse(iso) - Date.now()) < 10_000;

      const read = await http().get(`/api/ordenes/${orderId}`).set(as(buyer)).expect(200);
      expect(read.body.hora_servidor).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(near(read.body.hora_servidor)).toBe(true);

      const upload = await sendProof(buyer, orderId).expect(200);
      expect(upload.body).toMatchObject({ orden_id: orderId, estado: 'PENDING_VERIFICATION' });
      expect(near(upload.body.hora_servidor)).toBe(true);
    });

    it('a proof after the reservation lapsed is refused', async () => {
      const admin = (await signIn('admin')).token;
      const raffleId = await activeRaffle(admin);
      const buyer = (await signIn()).token;
      const reservation = await reserve(buyer, raffleId, [6]).expect(201);
      await lapse(raffleId, reservation.body.orden_id, { release: false });

      const res = await sendProof(buyer, reservation.body.orden_id).expect(409);
      expect(res.body.code).toBe('RESERVATION_EXPIRED');
    });

    it('refuses a file that is not an image or a PDF', async () => {
      const admin = (await signIn('admin')).token;
      const raffleId = await activeRaffle(admin);
      const buyer = (await signIn()).token;
      const reservation = await reserve(buyer, raffleId, [3]).expect(201);

      const res = await sendProof(buyer, reservation.body.orden_id, 10, Buffer.from('MZ not an image'));

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('INVALID_PAYMENT_PROOF');
    });

    it('refuses a file over the configured size', async () => {
      const admin = (await signIn('admin')).token;
      const raffleId = await activeRaffle(admin);
      const buyer = (await signIn()).token;
      const reservation = await reserve(buyer, raffleId, [4]).expect(201);

      const res = await sendProof(buyer, reservation.body.orden_id, 10, Buffer.concat([PNG, Buffer.alloc(5000)]));

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('INVALID_PAYMENT_PROOF');
    });

    it('serves the proof to its owner and to an operator, never cached', async () => {
      const admin = (await signIn('admin')).token;
      const { orderId, buyer } = await orderInVerification(admin);

      const own = await http().get(`/api/ordenes/${orderId}/comprobante`).set(as(buyer.token)).expect(200);
      expect(own.headers['content-type']).toBe('image/png');
      expect(own.headers['cache-control']).toBe('private, no-store');

      await http().get(`/api/ordenes/${orderId}/comprobante`).set(as(admin)).expect(200);
    });
  });

  // ---------------------------------------------------------- approvals

  describe('approval (§13)', () => {
    it('the operator approves: the order is paid and appears in the buyer tickets', async () => {
      const admin = (await signIn('admin')).token;
      const { orderId, buyer } = await paidOrder(admin);

      const order = await http().get(`/api/ordenes/${orderId}`).set(as(buyer.token)).expect(200);
      expect(order.body.estado).toBe('PAID');
      const mine = await http().get('/api/mis-boletos').set(as(buyer.token)).expect(200);
      expect(mine.body).toEqual([
        expect.objectContaining({ orden_id: orderId, estado: 'PAID', numeros: [1], titulo_rifa: 'Rifa Auto' }),
      ]);
      // The same reservation end as the order read, with no further request.
      expect(mine.body[0].vence_en).toBe(order.body.vence_en);
      expect(new Date(mine.body[0].vence_en).toISOString()).toBe(mine.body[0].vence_en);
    });

    it('a duplicate approval leaves the order as it was', async () => {
      const admin = (await signIn('admin')).token;
      const { orderId, buyer } = await paidOrder(admin);

      await http()
        .post(`/api/admin/ordenes/${orderId}/aprobar`)
        .set(as(admin))
        .send({ numero_operacion: opNumber(), monto_recibido: 10 });

      const order = await http().get(`/api/ordenes/${orderId}`).set(as(buyer.token)).expect(200);
      expect(order.body.estado).toBe('PAID');
      expect(await prisma.payment.count({ where: { orderId, status: 'APPROVED' } })).toBe(1);
    });

    it('refuses a received amount other than the total', async () => {
      const admin = (await signIn('admin')).token;
      const { orderId } = await orderInVerification(admin);

      const res = await http()
        .post(`/api/admin/ordenes/${orderId}/aprobar`)
        .set(as(admin))
        .send({ numero_operacion: opNumber(), monto_recibido: 9 })
        .expect(422);
      expect(res.body.code).toBe('PAYMENT_AMOUNT_MISMATCH');
    });

    it('refuses an operation number already recorded', async () => {
      const admin = (await signIn('admin')).token;
      const number = opNumber();
      const first = await orderInVerification(admin);
      await http()
        .post(`/api/admin/ordenes/${first.orderId}/aprobar`)
        .set(as(admin))
        .send({ numero_operacion: number, monto_recibido: 10 })
        .expect(204);
      const second = await orderInVerification(admin);

      const res = await http()
        .post(`/api/admin/ordenes/${second.orderId}/aprobar`)
        .set(as(admin))
        .send({ numero_operacion: number, monto_recibido: 10 })
        .expect(409);
      expect(res.body.code).toBe('DUPLICATE_OPERATION');
    });

    it('lists the pending proofs and the sales of a raffle', async () => {
      const admin = (await signIn('admin')).token;
      const { raffleId, orderId } = await orderInVerification(admin);

      const allPending = await http().get('/api/admin/comprobantes').set(as(admin)).expect(200);
      expect(allPending.body).toEqual(expect.arrayContaining([expect.objectContaining({ orden_id: orderId, numero_operacion: expect.any(String) })]));
      const pending = await http().get(`/api/admin/rifas/${raffleId}/comprobantes`).set(as(admin)).expect(200);
      expect(pending.body).toEqual([expect.objectContaining({ orden_id: orderId, numero_operacion: expect.any(String) })]);
      const sales = await http().get(`/api/admin/rifas/${raffleId}/ventas`).set(as(admin)).expect(200);
      expect(sales.body).toMatchObject({ boletos_reservados: 1, ordenes_por_estado: { PENDING_VERIFICATION: 1 } });
    });
  });

  // ---------------------------------------------------------- rejections

  describe('rejection (§13)', () => {
    it('without money received: the numbers are free again', async () => {
      const admin = (await signIn('admin')).token;
      const { orderId, buyer, raffleId } = await orderInVerification(admin, [5]);

      await http()
        .post(`/api/admin/ordenes/${orderId}/rechazar`)
        .set(as(admin))
        .send({ dinero_recibido: false, motivo: 'Comprobante ilegible' })
        .expect(204);

      const order = await http().get(`/api/ordenes/${orderId}`).set(as(buyer.token)).expect(200);
      expect(order.body).toMatchObject({ estado: 'REJECTED', motivo_rechazo: 'Comprobante ilegible' });
      const grid = await http().get(`/api/rifas/${raffleId}`).expect(200);
      expect(grid.body.grilla.numeros[4]).toEqual({ numero: 5, estado: 'AVAILABLE' });
    });

    it('with money received: a refund opens for the amount received', async () => {
      const admin = (await signIn('admin')).token;
      const { orderId } = await orderInVerification(admin);

      await http()
        .post(`/api/admin/ordenes/${orderId}/rechazar`)
        .set(as(admin))
        .send({ dinero_recibido: true, motivo: 'Fuera de plazo', monto_recibido: 10, banco_o_billetera: 'BCP', numero_operacion: opNumber() })
        .expect(204);

      const refunds = await http().get('/api/admin/reembolsos').set(as(admin)).expect(200);
      expect(refunds.body).toContainEqual(expect.objectContaining({ orden_id: orderId, monto: 10, estado: 'PENDING' }));
    });

    it('needs to know whether money arrived', async () => {
      const admin = (await signIn('admin')).token;
      const { orderId } = await orderInVerification(admin);

      const res = await http().post(`/api/admin/ordenes/${orderId}/rechazar`).set(as(admin)).send({ motivo: 'Sin datos' }).expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('a repeat with other money details is refused', async () => {
      const admin = (await signIn('admin')).token;
      const { orderId } = await orderInVerification(admin);
      const body = { dinero_recibido: true, motivo: 'X', monto_recibido: 10, banco_o_billetera: 'BCP', numero_operacion: opNumber() };
      await http().post(`/api/admin/ordenes/${orderId}/rechazar`).set(as(admin)).send(body).expect(204);

      await http().post(`/api/admin/ordenes/${orderId}/rechazar`).set(as(admin)).send(body).expect(204);
      const res = await http()
        .post(`/api/admin/ordenes/${orderId}/rechazar`)
        .set(as(admin))
        .send({ ...body, numero_operacion: opNumber() })
        .expect(409);
      expect(res.body.code).toBe('CONFLICTING_REJECTION');
    });

    it('more than the total needs a confirmed overpayment (DT-14)', async () => {
      const admin = (await signIn('admin')).token;
      const { orderId } = await orderInVerification(admin);
      const body = { dinero_recibido: true, motivo: 'X', monto_recibido: 15, banco_o_billetera: 'BCP', numero_operacion: opNumber() };

      const refused = await http().post(`/api/admin/ordenes/${orderId}/rechazar`).set(as(admin)).send(body).expect(422);
      expect(refused.body.code).toBe('OVERPAYMENT_NOT_CONFIRMED');

      await http()
        .post(`/api/admin/ordenes/${orderId}/rechazar`)
        .set(as(admin))
        .send({ ...body, sobrepago: { confirmado: true, motivo: 'Transfirió de más' } })
        .expect(204);
    });
  });

  // ---------------------------------------------- late payments and alerts

  describe('late payment and operator alerts (§13, DT-07, DT-09)', () => {
    async function claim() {
      const admin = (await signIn('admin')).token;
      const raffleId = await activeRaffle(admin);
      const buyer = (await signIn()).token;
      const reservation = await reserve(buyer, raffleId, [9]).expect(201);
      const orderId = reservation.body.orden_id as string;
      await lapse(raffleId, orderId);
      const res = await http()
        .post(`/api/ordenes/${orderId}/pago-tardio`)
        .set(as(buyer))
        .set('X-Forwarded-For', freshIp())
        .field('banco_o_billetera', 'PLIN')
        .field('monto_declarado', '10')
        .field('numero_operacion', opNumber())
        .attach('archivo', PNG, 'proof.png');
      return { admin, buyer, orderId, res };
    }

    it('a claim enters the review queue and alerts the operators in the panel', async () => {
      const { admin, orderId, res } = await claim();

      expect(res.status).toBe(202);
      expect(res.body.estado).toBe('LATE_PAYMENT_REVIEW');
      const queue = await http().get('/api/admin/pagos-tardios').set(as(admin)).expect(200);
      expect(queue.body.map((o: { orden_id: string }) => o.orden_id)).toContain(orderId);
      const alerts = await http().get('/api/admin/alertas').set(as(admin)).expect(200);
      expect(alerts.body).toContainEqual(expect.objectContaining({ orden_id: orderId, tipo: 'LATE_PAYMENT_CLAIM' }));
    });

    it('confirming the claim opens the refund and clears the alert', async () => {
      const { admin, orderId } = await claim();

      await http()
        .post(`/api/admin/ordenes/${orderId}/pago-tardio/confirmar`)
        .set(as(admin))
        .send({ monto_recibido: 10, banco_o_billetera: 'PLIN', numero_operacion: opNumber() })
        .expect(204);

      const alerts = await http().get('/api/admin/alertas').set(as(admin)).expect(200);
      expect(alerts.body.map((a: { orden_id: string }) => a.orden_id)).not.toContain(orderId);
      const refunds = await http().get('/api/admin/reembolsos').set(as(admin)).expect(200);
      expect(refunds.body).toContainEqual(expect.objectContaining({ orden_id: orderId, monto: 10 }));
    });

    it('dismissing the claim needs a reason, and closes it', async () => {
      const { admin, buyer, orderId } = await claim();

      await http().post(`/api/admin/ordenes/${orderId}/pago-tardio/descartar`).set(as(admin)).send({ motivo: ' ' }).expect(400);
      await http()
        .post(`/api/admin/ordenes/${orderId}/pago-tardio/descartar`)
        .set(as(admin))
        .send({ motivo: 'No llegó dinero' })
        .expect(204);

      const order = await http().get(`/api/ordenes/${orderId}`).set(as(buyer)).expect(200);
      expect(order.body.estado).toBe('LATE_PAYMENT_DISMISSED');
    });

    it('an operator marks an alert read for everyone', async () => {
      const { admin, orderId } = await claim();
      const alerts = await http().get('/api/admin/alertas').set(as(admin)).expect(200);
      const alert = alerts.body.find((a: { orden_id: string }) => a.orden_id === orderId);

      await http().post(`/api/admin/alertas/${alert.alerta_id}/leida`).set(as(admin)).expect(204);

      const other = (await signIn('admin')).token;
      const after = await http().get('/api/admin/alertas').set(as(other)).expect(200);
      expect(after.body.map((a: { alerta_id: string }) => a.alerta_id)).not.toContain(alert.alerta_id);
    });
  });

  // --------------------------------------------- refunds and extra transfers

  describe('refunds and extra transfers (DT-16, DT-17)', () => {
    it('an extra transfer on a paid order opens its own refund (DT-16)', async () => {
      const admin = (await signIn('admin')).token;
      const { orderId, buyer } = await paidOrder(admin);

      await http()
        .post(`/api/admin/ordenes/${orderId}/transferencia-extra`)
        .set(as(admin))
        .send({ monto_recibido: 10, banco_o_billetera: 'YAPE', numero_operacion: opNumber(), motivo: 'Pagó dos veces' })
        .expect(204);

      const refunds = await http().get('/api/admin/reembolsos').set(as(admin)).expect(200);
      expect(refunds.body).toContainEqual(expect.objectContaining({ orden_id: orderId, pago_id: expect.any(String) }));
      const order = await http().get(`/api/ordenes/${orderId}`).set(as(buyer.token)).expect(200);
      expect(order.body.estado).toBe('PAID');
    });

    it('an extra transfer on an order in verification is refused (DT-16)', async () => {
      const admin = (await signIn('admin')).token;
      const { orderId } = await orderInVerification(admin);

      const res = await http()
        .post(`/api/admin/ordenes/${orderId}/transferencia-extra`)
        .set(as(admin))
        .send({ monto_recibido: 10, banco_o_billetera: 'YAPE', numero_operacion: opNumber(), motivo: 'X' })
        .expect(409);
      expect(res.body.code).toBe('EXTRA_TRANSFER_NOT_ACCEPTED');
    });

    it('whoever recorded the money cannot complete its refund; another operator can (DT-17)', async () => {
      const admin = (await signIn('admin')).token;
      const { orderId } = await orderInVerification(admin);
      await http()
        .post(`/api/admin/ordenes/${orderId}/rechazar`)
        .set(as(admin))
        .send({ dinero_recibido: true, motivo: 'X', monto_recibido: 10, banco_o_billetera: 'BCP', numero_operacion: opNumber() })
        .expect(204);
      const refunds = await http().get('/api/admin/reembolsos').set(as(admin)).expect(200);
      const refund = refunds.body.find((r: { orden_id: string }) => r.orden_id === orderId);
      const body = { destino: 'Yape 999888777', numero_operacion: opNumber() };

      const same = await http().post(`/api/admin/reembolsos/${refund.reembolso_id}/completar`).set(as(admin)).send(body).expect(409);
      expect(same.body.code).toBe('SAME_OPERATOR_REFUND');

      const other = (await signIn('admin')).token;
      await http().post(`/api/admin/reembolsos/${refund.reembolso_id}/completar`).set(as(other)).send(body).expect(204);
      const after = await http().get('/api/admin/reembolsos').set(as(other)).expect(200);
      expect(after.body.map((r: { reembolso_id: string }) => r.reembolso_id)).not.toContain(refund.reembolso_id);
    });

    it('lists the collisions and refuses to requeue an unknown email', async () => {
      const admin = (await signIn('admin')).token;

      const collisions = await http().get('/api/admin/pagos/colisiones').set(as(admin)).expect(200);
      expect(Array.isArray(collisions.body)).toBe(true);
      const res = await http().post(`/api/admin/notificaciones/${randomUUID()}/reencolar`).set(as(admin)).expect(404);
      expect(res.body.code).toBe('NOTIFICATION_NOT_FOUND');
    });
  });

  // --------------------------------------------------- close, draw, verify

  describe('close, draw and verification (§13)', () => {
    async function closedRaffle() {
      const admin = (await signIn('admin')).token;
      const { raffleId } = await paidOrder(admin);
      await moveCloseOfSales(raffleId, new Date(Date.now() - 1000));
      await new CloseSalesUseCase(
        app.get(PrismaRaffleRepository),
        app.get(PrismaTicketLedger),
        seedVaultFrom(app.get(ConfigService)),
        new SystemClock(),
      ).execute(raffleId);
      return { admin, raffleId };
    }

    it('shows the frozen list and the seed once closed, then the official result', async () => {
      const { admin, raffleId } = await closedRaffle();

      const live = await http().get(`/api/rifas/${raffleId}/en-vivo`).expect(200);
      expect(live.body).toMatchObject({ estado: 'CLOSED', numeros_vendidos: [1], resultado: null });
      expect(live.body.semilla_revelada).toMatch(/^[0-9a-f]{64}$/);

      const draw = await http().post(`/api/admin/rifas/${raffleId}/sorteo`).set(as(admin)).expect(200);
      expect(draw.body).toMatchObject({ numero_ganador: 1, ronda_drand: live.body.ronda_drand });

      const verification = await http().get(`/api/rifas/${raffleId}/verificacion`).expect(200);
      expect(verification.body).toMatchObject({ lista_verificada: true, numero_ganador: 1, ronda_drand: live.body.ronda_drand });
      // The round is roundAt(fecha_sorteo) on quicknet: the browser checks the binding.
      expect(verification.body.fecha_sorteo).toBe(live.body.fecha_sorteo);
      expect(verification.body.cierre_ventas).toBe(live.body.cierre_ventas);
      expect(Number(verification.body.ronda_drand)).toBeGreaterThan(
        roundAt(Date.parse(verification.body.cierre_ventas), { genesisTimeSec: 1692803367, periodSec: 3 }),
      );
      expect(verification.body.ronda_drand).toBe(
        String(roundAt(Date.parse(verification.body.fecha_sorteo), { genesisTimeSec: 1692803367, periodSec: 3 })),
      );
      const after = await http().get(`/api/rifas/${raffleId}/en-vivo`).expect(200);
      expect(after.body.resultado).toMatchObject({ numero_ganador: 1 });
    });

    it('refuses to cancel a closed raffle whose list is intact (DT-15)', async () => {
      const { admin, raffleId } = await closedRaffle();

      await http().post(`/api/admin/rifas/${raffleId}/cancelar-lista-alterada`).set(as(admin)).send({ motivo: '' }).expect(400);
      const res = await http()
        .post(`/api/admin/rifas/${raffleId}/cancelar-lista-alterada`)
        .set(as(admin))
        .send({ motivo: 'Sospecha' })
        .expect(409);
      expect(res.body.code).toBe('SOLD_LIST_INTACT');
    });

    it('refuses an approval after the close', async () => {
      const admin = (await signIn('admin')).token;
      const ctx = await orderInVerification(admin);
      await moveCloseOfSales(ctx.raffleId, new Date(Date.now() - 1000));

      const res = await http()
        .post(`/api/admin/ordenes/${ctx.orderId}/aprobar`)
        .set(as(admin))
        .send({ numero_operacion: opNumber(), monto_recibido: 10 })
        .expect(409);
      expect(res.body.code).toBe('SALES_CLOSED');
    });
  });
});
