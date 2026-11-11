import { Page, Request } from '@playwright/test';
import { ORDER_ID, RAFFLE_ID } from './raffle-mock';

/**
 * Stubs the buyer order routes of tiendi-rifas-api (buyer.controller.ts):
 * `GET /api/ordenes/:id` and `POST /api/ordenes/:id/comprobante`
 * (multipart: `archivo`, `numero_operacion`, `banco_o_billetera`,
 * `monto_declarado`, `cuenta_id`, `cuenta_version`), both answering `presenters.orderWithServerTime`, and
 * the public `GET /api/cuentas-pago` (`presenters.publicPaymentAccount`).
 *
 * Every order answer carries `hora_servidor`: the clock of a server that runs
 * `SERVER_BEHIND_MS` behind the page clock. No `Date` header is sent or
 * exposed: the web reads the server time from the body only.
 */

/** Local time the tests install with `page.clock`. */
export const LOCAL_START = new Date('2026-11-03T15:03:00.000Z');
/** The server clock is 3 minutes behind the buyer's phone. */
export const SERVER_BEHIND_MS = 3 * 60_000;
/** 15 minutes after the server reserved, at 15:00 server time. */
export const RESERVED_UNTIL = '2026-11-03T15:15:00.000Z';

const PNG_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
export const PNG_PROOF = { name: 'voucher.png', mimeType: 'image/png', buffer: Buffer.from(PNG_BYTES) };

export type OrderStatus =
  | 'PENDING'
  | 'PENDING_VERIFICATION'
  | 'PAID'
  | 'EXPIRED'
  | 'LATE_PAYMENT_REVIEW'
  | 'LATE_PAYMENT_DISMISSED'
  | 'REJECTED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

/** `presenters.order`: the keys of every order route, before `hora_servidor`. */
export const paymentOrderDto = (overrides: Record<string, unknown> = {}) => ({
  orden_id: ORDER_ID,
  rifa_id: RAFFLE_ID,
  estado: 'PENDING' as OrderStatus,
  numeros: [7, 23],
  monto_total: 20,
  vence_en: RESERVED_UNTIL,
  verificacion_vence_en: null as string | null,
  monto_declarado: null as number | null,
  banco_o_billetera: null as string | null,
  motivo_rechazo: null as string | null,
  tiene_comprobante: false,
  creada_en: '2026-11-03T15:00:00.000Z',
  /** The account the buyer declared paying to (DT-19); null before the proof. */
  cuenta_destino: null as Record<string, unknown> | null,
  ...overrides,
});

/** `presenters.publicPaymentAccount`: digits only, no state or operator ids. */
export const paymentAccountDtos = () => [
  { cuenta_id: 'acc-1', metodo: 'YAPE', titular: 'Operador de ejemplo', numero: '999888777', cci: null, version: 1 },
  {
    cuenta_id: 'acc-2',
    metodo: 'BCP',
    titular: 'Operador de ejemplo',
    numero: '19100000000000',
    cci: '00219100000000000000',
    version: 1,
  },
];

export interface Reply {
  status: number;
  body: unknown;
}

/** The order as the server holds it; tests move it as an operator would. */
export interface FakeOrder {
  dto: ReturnType<typeof paymentOrderDto>;
  /** Number of `GET /api/ordenes/:id` answered. */
  reads: number;
  proofs: Request[];
  /** The answer to the next proof upload; by default it moves to verification. */
  nextProofReply: Reply | null;
  /** While set, every order read answers with it (404 for another buyer's order). */
  readReply: Reply | null;
  /** The answer of `GET /api/cuentas-pago`. */
  accountsReply: Reply;
  /** Number of `GET /api/cuentas-pago` answered. */
  accountReads: number;
}

/** The server clock now: the page clock minus `SERVER_BEHIND_MS`. */
async function serverTime(page: Page): Promise<string> {
  const local = await page.evaluate(() => Date.now()).catch(() => LOCAL_START.getTime());
  return new Date(local - SERVER_BEHIND_MS).toISOString();
}

type Route = Parameters<Parameters<Page['route']>[1]>[0];

const fulfill = (route: Route, { status, body }: Reply) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': 'http://localhost:4200' },
    body: JSON.stringify(body),
  });

export async function mockPayment(page: Page, overrides: Record<string, unknown> = {}): Promise<FakeOrder> {
  const fake: FakeOrder = {
    dto: paymentOrderDto(overrides),
    reads: 0,
    proofs: [],
    nextProofReply: null,
    readReply: null,
    accountsReply: { status: 200, body: paymentAccountDtos() },
    accountReads: 0,
  };

  const activeAccounts = (): ReturnType<typeof paymentAccountDtos> =>
    fake.accountsReply.status === 200 ? (fake.accountsReply.body as ReturnType<typeof paymentAccountDtos>) : [];

  /** An order answer of the real contract: the order plus the server clock. */
  const orderReply = async (): Promise<Reply> => ({
    status: 200,
    body: { ...fake.dto, hora_servidor: await serverTime(page) },
  });

  await page.route(
    (url) => url.pathname === '/api/cuentas-pago',
    (route) => {
      fake.accountReads++;
      return fulfill(route, fake.accountsReply);
    },
  );

  await page.route(
    (url) => url.pathname === `/api/ordenes/${ORDER_ID}`,
    async (route) => {
      if (route.request().method() !== 'GET') {
        return route.fallback();
      }
      fake.reads++;
      return fulfill(route, fake.readReply ?? (await orderReply()));
    },
  );

  await page.route(
    (url) => url.pathname === `/api/ordenes/${ORDER_ID}/comprobante`,
    async (route) => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }
      fake.proofs.push(route.request());
      const reply = fake.nextProofReply;
      fake.nextProofReply = null;
      if (reply) {
        return fulfill(route, reply);
      }
      // As the API: `cuenta_id` must name an active account, else 422, at the
      // version the buyer saw, else 409 (DT-19).
      const fields = multipartFields(route.request());
      const paidTo = activeAccounts().find((a) => a.cuenta_id === fields['cuenta_id']);
      if (!paidTo) {
        return fulfill(route, {
          status: 422,
          body: { code: 'PAYMENT_ACCOUNT_UNAVAILABLE', message: 'Payment account is not active' },
        });
      }
      if (String(paidTo.version) !== fields['cuenta_version']) {
        return fulfill(route, {
          status: 409,
          body: { code: 'PAYMENT_ACCOUNT_CHANGED', message: 'Payment account changed' },
        });
      }
      fake.dto = {
        ...fake.dto,
        estado: 'PENDING_VERIFICATION',
        tiene_comprobante: true,
        monto_declarado: 20,
        banco_o_billetera: 'YAPE',
        verificacion_vence_en: '2026-11-04T03:00:00.000Z',
        cuenta_destino: { ...paidTo },
      };
      return fulfill(route, await orderReply());
    },
  );

  return fake;
}

/** The text fields of a multipart upload, by name. */
export function multipartFields(request: Request): Record<string, string> {
  const body = request.postDataBuffer()?.toString('latin1') ?? '';
  const fields: Record<string, string> = {};
  for (const part of body.split(/--[^\r\n]+\r\n/)) {
    const name = /name="([^"]+)"(?!; filename)/.exec(part)?.[1];
    if (name && !/filename="/.test(part)) {
      fields[name] = part.split('\r\n\r\n')[1]?.replace(/\r\n(--)?$/, '').trim() ?? '';
    }
  }
  return fields;
}

/** Names of the files of a multipart upload, by field. */
export function multipartFiles(request: Request): Record<string, string> {
  const body = request.postDataBuffer()?.toString('latin1') ?? '';
  const files: Record<string, string> = {};
  for (const match of body.matchAll(/name="([^"]+)"; filename="([^"]*)"/g)) {
    files[match[1]] = match[2];
  }
  return files;
}
