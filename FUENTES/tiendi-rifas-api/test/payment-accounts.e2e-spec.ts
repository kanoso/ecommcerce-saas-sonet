import { randomUUID } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

/** A fresh 9-digit mobile per test: the database is shared by every run. */
function mobile(): string {
  return `9${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
}

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);

type Caller = { token: string; userId: string };

describe('Payment accounts over HTTP (DT-19, four eyes)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let ipCounter = 0;
  let proposer: Caller;
  let approver: Caller;
  let buyer: Caller;

  const freshIp = () => `10.9.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;
  const http = () => request(app.getHttpServer());
  const as = (caller: Caller) => ({ Authorization: `Bearer ${caller.token}` });

  async function signIn(role: 'buyer' | 'admin'): Promise<Caller> {
    const email = `${randomUUID()}@test.local`;
    await http().post('/api/auth/enlace').set('X-Forwarded-For', freshIp()).send({ email }).expect(202);
    const row = await prisma.notificationOutbox.findFirst({
      where: { type: 'MAGIC_LINK', recipient: email },
      orderBy: { createdAt: 'desc' },
    });
    const token = new URL((row!.payload as { link: string }).link).hash.replace('#token=', '');
    const res = await http().post('/api/auth/sesion').set('X-Forwarded-For', freshIp()).send({ token }).expect(200);
    if (role === 'admin') {
      await prisma.user.update({ where: { email }, data: { role: 'admin' } });
    }
    return { token: res.body.token_acceso, userId: res.body.usuario.usuario_id };
  }

  const proposeAccount = (body: Record<string, unknown>, by: Caller = proposer) =>
    http().post('/api/admin/cuentas-pago').set(as(by)).send(body);
  const approveChange = (changeId: string, by: Caller = approver) =>
    http().post(`/api/admin/cuentas-pago/cambios/${changeId}/aprobar`).set(as(by));

  /** Proposed by one operator, approved by another: public. */
  async function liveAccount(body: Record<string, unknown> = {}): Promise<string> {
    const proposed = await proposeAccount({ metodo: 'YAPE', titular: 'Rifas Tiendi SAC', numero: mobile(), ...body }).expect(202);
    await approveChange(proposed.body.solicitud_id).expect(200);
    return proposed.body.cuenta_id as string;
  }

  const publicIds = async (): Promise<string[]> =>
    (await http().get('/api/cuentas-pago').expect(200)).body.map((a: { cuenta_id: string }) => a.cuenta_id);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = new PrismaClient();
    proposer = await signIn('admin');
    approver = await signIn('admin');
    buyer = await signIn('buyer');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  describe('four eyes', () => {
    it('a new account is only proposed (202): not public until ANOTHER operator approves it', async () => {
      const phone = mobile();

      const proposed = await proposeAccount({ metodo: 'YAPE', titular: 'Rifas Tiendi SAC', numero: phone, orden: 1 }).expect(202);

      expect(proposed.body).toMatchObject({
        solicitud_id: expect.any(String),
        tipo: 'CREATE',
        estado: 'PENDING',
        propuesta: { metodo: 'YAPE', titular: 'Rifas Tiendi SAC', numero: phone, cci: null, orden: 1 },
        anterior: null,
        propuesta_por: proposer.userId,
      });
      const accountId = proposed.body.cuenta_id as string;
      expect(await publicIds()).not.toContain(accountId);
      const pending = await http().get('/api/admin/cuentas-pago/cambios').set(as(approver)).expect(200);
      expect(pending.body.map((c: { solicitud_id: string }) => c.solicitud_id)).toContain(proposed.body.solicitud_id);

      const own = await approveChange(proposed.body.solicitud_id, proposer).expect(409);
      expect(own.body.code).toBe('SAME_OPERATOR_APPROVAL');
      expect(await publicIds()).not.toContain(accountId);

      const approved = await approveChange(proposed.body.solicitud_id).expect(200);
      expect(approved.body).toMatchObject({
        cuenta_id: accountId,
        activa: true,
        version: 1,
        creada_por: proposer.userId,
        actualizada_por: approver.userId,
      });
      expect(await publicIds()).toContain(accountId);
    });

    it('audits and alerts every proposal and decision, in-app and by email', async () => {
      const proposed = await proposeAccount({ metodo: 'PLIN', titular: 'Rifas Tiendi SAC', numero: mobile() }).expect(202);
      const accountId = proposed.body.cuenta_id as string;
      await approveChange(proposed.body.solicitud_id).expect(200);

      const audits = await prisma.paymentAccountAudit.findMany({ where: { accountId }, orderBy: { occurredAt: 'asc' } });
      expect(audits.map((a) => [a.action, a.operatorId])).toEqual([
        ['PROPOSED', proposer.userId],
        ['APPROVED', approver.userId],
      ]);
      expect(
        await prisma.notificationOutbox.count({
          where: { dedupeKey: { in: audits.map((a) => `PAYMENT_ACCOUNT_CHANGED:${a.id}`) } },
        }),
      ).toBe(2);
      const alerts = await http().get('/api/admin/alertas').set(as(approver)).expect(200);
      expect(alerts.body.filter((a: { cuenta_pago_id: string }) => a.cuenta_pago_id === accountId)).toEqual([
        expect.objectContaining({ tipo: 'PAYMENT_ACCOUNT_CHANGE', rifa_id: null }),
        expect.objectContaining({ tipo: 'PAYMENT_ACCOUNT_CHANGE', rifa_id: null }),
      ]);
    });

    it('a new number is proposed; buyers see the old one until approval', async () => {
      const oldPhone = mobile();
      const accountId = await liveAccount({ numero: oldPhone });
      const newPhone = mobile();

      const proposed = await http()
        .patch(`/api/admin/cuentas-pago/${accountId}`)
        .set(as(proposer))
        .send({ numero: newPhone })
        .expect(202);

      expect(proposed.body).toMatchObject({ tipo: 'UPDATE', anterior: { numero: oldPhone }, propuesta: { numero: newPhone } });
      const shown = async () =>
        (await http().get('/api/cuentas-pago').expect(200)).body.find((a: { cuenta_id: string }) => a.cuenta_id === accountId);
      expect((await shown()).numero).toBe(oldPhone);

      await approveChange(proposed.body.solicitud_id).expect(200);
      expect((await shown()).numero).toBe(newPhone);
    });

    it('a pure reorder and a deactivation apply at once (200); activating again is proposed', async () => {
      const accountId = await liveAccount();

      const reordered = await http()
        .patch(`/api/admin/cuentas-pago/${accountId}`)
        .set(as(proposer))
        .send({ orden: 7 })
        .expect(200);
      expect(reordered.body).toMatchObject({ orden: 7, version: 2 });

      await http().post(`/api/admin/cuentas-pago/${accountId}/desactivar`).set(as(proposer)).expect(200);
      expect(await publicIds()).not.toContain(accountId);

      const activation = await http().post(`/api/admin/cuentas-pago/${accountId}/activar`).set(as(proposer)).expect(202);
      expect(activation.body).toMatchObject({ tipo: 'ACTIVATE', estado: 'PENDING' });
      expect(await publicIds()).not.toContain(accountId);
      await approveChange(activation.body.solicitud_id).expect(200);
      expect(await publicIds()).toContain(accountId);
    });

    it('another operator rejects; only the proposer cancels', async () => {
      const first = await proposeAccount({ metodo: 'YAPE', titular: 'Rifas Tiendi SAC', numero: mobile() }).expect(202);
      const second = await proposeAccount({ metodo: 'YAPE', titular: 'Rifas Tiendi SAC', numero: mobile() }).expect(202);

      const ownReject = await http().post(`/api/admin/cuentas-pago/cambios/${first.body.solicitud_id}/rechazar`).set(as(proposer)).expect(409);
      expect(ownReject.body.code).toBe('SAME_OPERATOR_APPROVAL');
      const rejected = await http().post(`/api/admin/cuentas-pago/cambios/${first.body.solicitud_id}/rechazar`).set(as(approver)).expect(200);
      expect(rejected.body).toMatchObject({ estado: 'REJECTED', decidida_por: approver.userId });

      const othersCancel = await http().post(`/api/admin/cuentas-pago/cambios/${second.body.solicitud_id}/cancelar`).set(as(approver)).expect(403);
      expect(othersCancel.body.code).toBe('NOT_CHANGE_PROPOSER');
      const cancelled = await http().post(`/api/admin/cuentas-pago/cambios/${second.body.solicitud_id}/cancelar`).set(as(proposer)).expect(200);
      expect(cancelled.body.estado).toBe('CANCELLED');

      const closed = await approveChange(first.body.solicitud_id).expect(409);
      expect(closed.body.code).toBe('PAYMENT_ACCOUNT_CHANGE_CLOSED');
      expect(await publicIds()).not.toContain(first.body.cuenta_id);
      expect(await publicIds()).not.toContain(second.body.cuenta_id);
      const actions = await prisma.paymentAccountAudit.findMany({
        where: { changeId: { in: [first.body.solicitud_id, second.body.solicitud_id] } },
        select: { action: true },
      });
      expect(actions.map((a) => a.action).sort()).toEqual(['CANCELLED', 'PROPOSED', 'PROPOSED', 'REJECTED']);
    });
  });

  describe('public list and admin routes', () => {
    it('shows buyers only active accounts, in order, without state, audit or operator ids', async () => {
      const shown = await liveAccount({ orden: 10 });
      const hidden = await liveAccount({ metodo: 'PLIN', orden: 11 });
      await http().post(`/api/admin/cuentas-pago/${hidden}/desactivar`).set(as(proposer)).expect(200);

      const res = await http().get('/api/cuentas-pago').expect(200);

      const ids = res.body.map((a: { cuenta_id: string }) => a.cuenta_id);
      expect(ids).toContain(shown);
      expect(ids).not.toContain(hidden);
      for (const account of res.body) {
        expect(Object.keys(account).sort()).toEqual(['cci', 'cuenta_id', 'metodo', 'numero', 'titular', 'version']);
      }
      const orders = new Map(
        (await prisma.paymentAccount.findMany({ where: { id: { in: ids } } })).map((a) => [a.id, a.displayOrder]),
      );
      const listed = ids.map((id: string) => orders.get(id)!);
      expect(listed).toEqual([...listed].sort((a, b) => a - b));
    });

    it('refuses a buyer on every admin route with 403, and changes nothing', async () => {
      const accountId = await liveAccount();
      const audits = await prisma.paymentAccountAudit.count({ where: { accountId } });
      const changeId = randomUUID();
      const attempts = [
        () => http().post('/api/admin/cuentas-pago').set(as(buyer)).send({ metodo: 'YAPE', titular: 'Ladron', numero: mobile() }),
        () => http().patch(`/api/admin/cuentas-pago/${accountId}`).set(as(buyer)).send({ numero: mobile() }),
        () => http().post(`/api/admin/cuentas-pago/${accountId}/desactivar`).set(as(buyer)),
        () => http().post(`/api/admin/cuentas-pago/${accountId}/activar`).set(as(buyer)),
        () => http().get('/api/admin/cuentas-pago').set(as(buyer)),
        () => http().get('/api/admin/cuentas-pago/cambios').set(as(buyer)),
        () => http().post(`/api/admin/cuentas-pago/cambios/${changeId}/aprobar`).set(as(buyer)),
        () => http().post(`/api/admin/cuentas-pago/cambios/${changeId}/rechazar`).set(as(buyer)),
        () => http().post(`/api/admin/cuentas-pago/cambios/${changeId}/cancelar`).set(as(buyer)),
      ];
      for (const attempt of attempts) {
        expect((await attempt()).status).toBe(403);
      }
      expect(await prisma.paymentAccountAudit.count({ where: { accountId } })).toBe(audits);
    });

    it('validates fields with 422 and bounds orden to 0-999 with 400', async () => {
      const badPhone = await proposeAccount({ metodo: 'YAPE', titular: 'Rifas Tiendi SAC', numero: '12345' }).expect(422);
      expect(badPhone.body.code).toBe('PAYMENT_ACCOUNT_INVALID');
      for (const orden of [-1, 1000]) {
        const res = await proposeAccount({ metodo: 'YAPE', titular: 'Rifas Tiendi SAC', numero: mobile(), orden }).expect(400);
        expect(res.body.code).toBe('VALIDATION_FAILED');
      }
      const sneaky = await proposeAccount({ metodo: 'YAPE', titular: 'Rifas', numero: mobile(), creada_por: 'x' }).expect(400);
      expect(sneaky.body.code).toBe('VALIDATION_FAILED');
      const accountId = await liveAccount();
      const badOrder = await http().patch(`/api/admin/cuentas-pago/${accountId}`).set(as(proposer)).send({ orden: 1000 }).expect(400);
      expect(badOrder.body.code).toBe('VALIDATION_FAILED');
    });

    it('answers a duplicate with 409, a second pending change with 409 and a missing account with 404', async () => {
      const phone = mobile();
      const accountId = await liveAccount({ numero: phone });

      const twice = await proposeAccount({ metodo: 'YAPE', titular: 'Otro', numero: phone }).expect(409);
      expect(twice.body.code).toBe('PAYMENT_ACCOUNT_DUPLICATE');
      const pendingPhone = mobile();
      await proposeAccount({ metodo: 'PLIN', titular: 'Rifas Tiendi SAC', numero: pendingPhone }).expect(202);
      const pendingTwice = await proposeAccount({ metodo: 'PLIN', titular: 'Otro', numero: pendingPhone }, approver).expect(409);
      expect(pendingTwice.body.code).toBe('PAYMENT_ACCOUNT_DUPLICATE');

      await http().patch(`/api/admin/cuentas-pago/${accountId}`).set(as(proposer)).send({ titular: 'Otra Persona' }).expect(202);
      const second = await http().patch(`/api/admin/cuentas-pago/${accountId}`).set(as(approver)).send({ titular: 'Tercera' }).expect(409);
      expect(second.body.code).toBe('PAYMENT_ACCOUNT_CHANGE_PENDING');

      const missing = await http().post(`/api/admin/cuentas-pago/${randomUUID()}/desactivar`).set(as(proposer)).expect(404);
      expect(missing.body.code).toBe('PAYMENT_ACCOUNT_NOT_FOUND');
    });

    it('offers no way to delete an account', async () => {
      const accountId = await liveAccount();

      expect((await http().delete(`/api/admin/cuentas-pago/${accountId}`).set(as(proposer))).status).toBe(404);
      expect(await prisma.paymentAccount.count({ where: { id: accountId } })).toBe(1);
    });
  });

  describe('the account a proof was paid to', () => {
    async function pendingOrder(): Promise<{ orderId: string; raffleId: string; buyer: Caller }> {
      const created = await http()
        .post('/api/admin/rifas')
        .set(as(proposer))
        .send({ titulo: 'Rifa Auto', premio: 'Un auto', precio_boleto: 10, numero_min: 1, numero_max: 5 })
        .expect(201);
      const day = 24 * 3600_000;
      await http()
        .post(`/api/admin/rifas/${created.body.rifa_id}/publicar`)
        .set(as(proposer))
        .send({
          resolucion_autorizacion: 'RD-123-2026',
          cierre_ventas: new Date(Date.now() + 2 * day).toISOString(),
          fecha_sorteo: new Date(Date.now() + 3 * day).toISOString(),
        })
        .expect(200);
      const owner = await signIn('buyer');
      const reservation = await http()
        .post('/api/reservas')
        .set(as(owner))
        .set('X-Forwarded-For', freshIp())
        .send({ rifa_id: created.body.rifa_id, numeros: [1] })
        .expect(201);
      return { orderId: reservation.body.orden_id, raffleId: created.body.rifa_id, buyer: owner };
    }

    const sendProof = (owner: Caller, orderId: string, cuentaId?: string, version = 1) => {
      const req = http()
        .post(`/api/ordenes/${orderId}/comprobante`)
        .set(as(owner))
        .set('X-Forwarded-For', freshIp())
        .field('banco_o_billetera', 'YAPE')
        .field('monto_declarado', '10')
        .field('numero_operacion', `OP${randomUUID().slice(0, 8)}`);
      if (cuentaId) {
        req.field('cuenta_id', cuentaId).field('cuenta_version', String(version));
      }
      return req.attach('archivo', PNG, 'proof.png');
    };

    it('records the declared account as a copy, shown to the buyer and in the operator review', async () => {
      const phone = mobile();
      const accountId = await liveAccount({ titular: 'Cuenta Destino', numero: phone });
      const { orderId, raffleId, buyer: owner } = await pendingOrder();

      const upload = await sendProof(owner, orderId, accountId).expect(200);

      const expected = { cuenta_id: accountId, metodo: 'YAPE', titular: 'Cuenta Destino', numero: phone, cci: null, version: 1 };
      expect(upload.body.cuenta_destino).toEqual(expected);
      const read = await http().get(`/api/ordenes/${orderId}`).set(as(owner)).expect(200);
      expect(read.body.cuenta_destino).toEqual(expected);
      const review = await http().get(`/api/admin/rifas/${raffleId}/comprobantes`).set(as(proposer)).expect(200);
      expect(review.body.find((o: { orden_id: string }) => o.orden_id === orderId).cuenta_destino).toEqual(expected);

      // A later approved change does not rewrite what the buyer declared.
      const change = await http().patch(`/api/admin/cuentas-pago/${accountId}`).set(as(proposer)).send({ numero: mobile() }).expect(202);
      await approveChange(change.body.solicitud_id).expect(200);
      expect((await http().get(`/api/ordenes/${orderId}`).set(as(owner)).expect(200)).body.cuenta_destino.numero).toBe(phone);
    });

    it('refuses with 409 PAYMENT_ACCOUNT_CHANGED a proof made against an older version of the account', async () => {
      const accountId = await liveAccount();
      const { orderId, buyer: owner } = await pendingOrder();
      const seen = (await http().get('/api/cuentas-pago').expect(200)).body.find(
        (a: { cuenta_id: string }) => a.cuenta_id === accountId,
      );
      const change = await http().patch(`/api/admin/cuentas-pago/${accountId}`).set(as(proposer)).send({ titular: 'Otra Persona' }).expect(202);
      await approveChange(change.body.solicitud_id).expect(200);

      const refused = await sendProof(owner, orderId, accountId, seen.version).expect(409);

      expect(refused.body.code).toBe('PAYMENT_ACCOUNT_CHANGED');
      const read = await http().get(`/api/ordenes/${orderId}`).set(as(owner)).expect(200);
      expect(read.body).toMatchObject({ estado: 'PENDING', cuenta_destino: null });
      expect((await sendProof(owner, orderId, accountId, seen.version + 1).expect(200)).body.cuenta_destino).toMatchObject({
        titular: 'Otra Persona',
        version: seen.version + 1,
      });
    });

    it('requires cuenta_id (400) and refuses an inactive or unknown account (422)', async () => {
      const inactive = await liveAccount();
      await http().post(`/api/admin/cuentas-pago/${inactive}/desactivar`).set(as(proposer)).expect(200);
      const { orderId, buyer: owner } = await pendingOrder();

      expect((await sendProof(owner, orderId).expect(400)).body.code).toBe('VALIDATION_FAILED');
      expect((await sendProof(owner, orderId, inactive).expect(422)).body.code).toBe('PAYMENT_ACCOUNT_UNAVAILABLE');
      expect((await sendProof(owner, orderId, randomUUID()).expect(422)).body.code).toBe('PAYMENT_ACCOUNT_UNAVAILABLE');

      const read = await http().get(`/api/ordenes/${orderId}`).set(as(owner)).expect(200);
      expect(read.body).toMatchObject({ estado: 'PENDING', cuenta_destino: null });
    });
  });
});
