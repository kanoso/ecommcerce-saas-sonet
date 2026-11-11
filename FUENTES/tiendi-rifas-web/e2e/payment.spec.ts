import { Locator, Page, expect, test } from '@playwright/test';
import { apiError } from './support/api-mock';
import { givenStoredSession } from './support/auth-mock';
import { expectNoHorizontalScroll } from './support/no-horizontal-scroll';
import {
  FakeOrder,
  LOCAL_START,
  PNG_PROOF,
  mockPayment,
  multipartFields,
  paymentAccountDtos,
  multipartFiles,
} from './support/payment-mock';
import { ORDER_ID, RAFFLE_ID, mockRaffle } from './support/raffle-mock';

const PAYMENT_URL = `/rifas/${RAFFLE_ID}/pago/${ORDER_ID}`;

const timer = (page: Page) => page.getByRole('timer', { name: 'Tiempo restante de la reserva' });
const outcome = (page: Page) => page.getByRole('status').filter({ has: page.getByRole('heading', { level: 2 }) });
const submitButton = (page: Page) => page.getByRole('button', { name: 'Enviar comprobante' });
const accountsNotice = (page: Page) => page.getByRole('region', { name: '1. Transfiere el total' }).getByRole('alert');

/**
 * With the clock paused no timer fires, and the zoneless app renders on one.
 * Steps the clock 1 ms at a time until the check passes: a few ms in all, so
 * a countdown read this way is exact to the second.
 */
async function stepUntil(page: Page, check: () => Promise<void>): Promise<void> {
  await expect(async () => {
    await page.clock.runFor(1);
    await check();
  }).toPass({ timeout: 10_000 });
}

const expectTimer = (page: Page, text: string) =>
  stepUntil(page, () => expect(timer(page)).toHaveText(text, { timeout: 50 }));

const expectVisible = (page: Page, locator: Locator) =>
  stepUntil(page, () => expect(locator).toBeVisible({ timeout: 50 }));

/**
 * Opens the payment page on the fake clock. `paused` freezes it at
 * LOCAL_START before the first request, so every read and the countdown are
 * exact; otherwise it flows from LOCAL_START.
 */
async function openPayment(
  page: Page,
  overrides: Record<string, unknown> = {},
  { paused = false } = {},
): Promise<FakeOrder> {
  await givenStoredSession(page);
  await page.clock.install({ time: LOCAL_START });
  if (paused) {
    await page.clock.pauseAt(LOCAL_START);
  }
  const fake = await mockPayment(page, overrides);
  await page.goto(PAYMENT_URL);
  const heading = page.getByRole('heading', { level: 1, name: 'Pagar boletos' });
  if (paused) {
    await expectVisible(page, heading);
  } else {
    await expect(heading).toBeVisible();
  }
  return fake;
}

async function fillProof(page: Page, { file = true, paidTo = 'Yape · 999888777' as string | null } = {}): Promise<void> {
  if (paidTo) {
    await page.getByLabel('Cuenta a la que transferiste').selectOption({ label: paidTo });
  }
  await page.getByLabel('Banco o billetera desde la que pagaste').selectOption('YAPE');
  await page.getByLabel('N.° de operación').fill('00123456');
  await page.getByLabel('Monto pagado (S/)').fill('20.00');
  if (file) {
    await page.getByLabel('Subir foto o PDF del comprobante').setInputFiles(PNG_PROOF);
  }
  await page.getByRole('checkbox', { name: /Acepto los términos/ }).check();
}

/** An operator decides while the buyer watches: the next poll brings it. */
async function operatorDecides(page: Page, fake: FakeOrder, changes: Partial<FakeOrder['dto']>): Promise<void> {
  fake.dto = { ...fake.dto, ...changes };
  await page.clock.runFor(5000);
}

async function expectBackOnTheGridWithNotice(page: Page): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/rifas/${RAFFLE_ID}\\?reserva=vencida$`));
  await expect(page.getByRole('status').filter({ hasText: 'Tu reserva venció' })).toHaveText(
    'Tu reserva venció y tus números se liberaron. Puedes elegirlos de nuevo.',
  );
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Smart TV 55"');
}

const inVerification = {
  estado: 'PENDING_VERIFICATION',
  tiene_comprobante: true,
  monto_declarado: 20,
  banco_o_billetera: 'YAPE',
};

test.describe('Payment (/rifas/:id/pago/:orderId)', () => {
  test('counts down exactly on the server clock, sends the proof and follows it to PAID', async ({ page }) => {
    const fake = await openPayment(page, {}, { paused: true });

    // The phone is 3 minutes ahead: hora_servidor says 15 minutes are left, not 12.
    await expectTimer(page, '15:00');
    await page.clock.runFor(60_000);
    await expectTimer(page, '14:00');
    await page.clock.runFor(1000);
    await expectTimer(page, '13:59');

    const summary = page.getByRole('region', { name: 'Resumen de tu orden' });
    await expect(summary.getByRole('listitem')).toHaveText(['7', '23']);
    await expect(summary).toContainText(/Total\s*S\/\s20\.00/);
    const accounts = page.getByRole('list', { name: 'Cuentas de pago' });
    await expect(accounts.getByRole('listitem')).toHaveCount(2);
    await expect(accounts).toContainText('999888777');
    await expect(accounts).toContainText('CCI 00219100000000000000');
    expect(fake.accountReads).toBe(1);
    await expect(page.getByText(/tarjeta/i)).toHaveCount(0);
    await expect(submitButton(page)).toHaveCSS('min-height', '52px');
    await expectNoHorizontalScroll(page);

    await page.clock.resume();
    await fillProof(page);
    await submitButton(page).click();

    await expect(outcome(page).getByRole('heading')).toHaveText('Comprobante en verificación');
    await expect(outcome(page)).toContainText('Declaraste: Yape · S/');
    await expect(page.getByText('Pago aprobado')).toHaveCount(0);
    await expect(timer(page)).toHaveCount(0);
    expect(fake.proofs).toHaveLength(1);
    expect(multipartFields(fake.proofs[0])).toEqual({
      numero_operacion: '00123456',
      banco_o_billetera: 'YAPE',
      monto_declarado: '20.00',
      cuenta_id: 'acc-1',
      cuenta_version: '1',
    });
    await expect(outcome(page)).toContainText('Transferiste a: Yape · 999888777');
    expect(multipartFiles(fake.proofs[0])).toEqual({ archivo: 'voucher.png' });
    expect(await fake.proofs[0].headerValue('authorization')).toBe('Bearer stored-token');
    await expectNoHorizontalScroll(page);

    // Reloading in verification goes straight back to it.
    await page.reload();
    await expect(outcome(page).getByRole('heading')).toHaveText('Comprobante en verificación');
    await expect(page.getByRole('form')).toHaveCount(0);

    await operatorDecides(page, fake, { estado: 'PAID' });
    await expect(outcome(page).getByRole('heading')).toHaveText('Pago aprobado');
    const readsWhenPaid = fake.reads;
    await page.clock.runFor(30_000);
    expect(fake.reads, 'polling stops at PAID').toBe(readsWhenPaid);
    await expectNoHorizontalScroll(page);
  });

  test('asks which account the buyer paid to when there are several, and sends nothing without it', async ({ page }) => {
    const fake = await openPayment(page);
    await fillProof(page, { paidTo: null });

    await submitButton(page).click();

    await expect(page.getByText('Elige la cuenta a la que transferiste.')).toBeVisible();
    await expect(page.getByLabel('Cuenta a la que transferiste')).toHaveAttribute('aria-invalid', 'true');
    expect(fake.proofs).toHaveLength(0);

    await page.getByLabel('Cuenta a la que transferiste').selectOption({ label: 'BCP · 19100000000000' });
    await submitButton(page).click();

    await expect(outcome(page)).toContainText('Transferiste a: BCP · 19100000000000');
    expect(multipartFields(fake.proofs[0]).cuenta_id).toBe('acc-2');
    await expectNoHorizontalScroll(page);
  });

  test('preselects the only account, so the buyer need not pick it', async ({ page }) => {
    await givenStoredSession(page);
    await page.clock.install({ time: LOCAL_START });
    const fake = await mockPayment(page);
    fake.accountsReply = { status: 200, body: [paymentAccountDtos()[0]] };
    await page.goto(PAYMENT_URL);

    await expect(page.getByLabel('Cuenta a la que transferiste')).toHaveValue('acc-1');
    await fillProof(page, { paidTo: null });
    await submitButton(page).click();

    await expect(outcome(page).getByRole('heading')).toHaveText('Comprobante en verificación');
    expect(multipartFields(fake.proofs[0]).cuenta_id).toBe('acc-1');
    await expectNoHorizontalScroll(page);
  });

  test('when the account changed since it was shown, reads the accounts again and asks to check it', async ({ page }) => {
    const fake = await openPayment(page);
    await fillProof(page);
    // Another operator's approved change lands while the buyer fills the form.
    const [yape, bcp] = paymentAccountDtos();
    fake.accountsReply = { status: 200, body: [{ ...yape, titular: 'Titular Nuevo', version: 2 }, bcp] };

    await submitButton(page).click();

    const form = page.getByRole('form');
    await expect(form.getByRole('alert')).toHaveText(
      'Los datos de la cuenta de pago cambiaron. Revisa a qué cuenta transferiste y vuelve a enviar el comprobante.',
    );
    await expect(page.getByText('Revisa a qué cuenta transferiste.', { exact: true })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Cuentas de pago' })).toContainText('Titular: Titular Nuevo');
    expect(fake.accountReads).toBe(2);
    expect(multipartFields(fake.proofs[0]).cuenta_version).toBe('1');
    await expectNoHorizontalScroll(page);

    await submitButton(page).click();

    await expect(outcome(page).getByRole('heading')).toHaveText('Comprobante en verificación');
    expect(multipartFields(fake.proofs[1]).cuenta_version).toBe('2');
    await expectNoHorizontalScroll(page);
  });

  test('sends one upload for a double click', async ({ page }) => {
    const fake = await openPayment(page);
    await fillProof(page);

    await submitButton(page).dblclick();

    await expect(outcome(page).getByRole('heading')).toHaveText('Comprobante en verificación');
    expect(fake.proofs).toHaveLength(1);
    await expectNoHorizontalScroll(page);
  });

  test('polls in verification without overlapping reads, one per interval', async ({ page }) => {
    const fake = await openPayment(page, inVerification, { paused: true });
    await expectVisible(page, outcome(page));
    const first = fake.reads;

    await page.clock.runFor(5000);
    await stepUntil(page, async () => expect(fake.reads).toBe(first + 1));
    await page.clock.runFor(5000);
    await stepUntil(page, async () => expect(fake.reads).toBe(first + 2));
    await expectNoHorizontalScroll(page);
  });

  test('shows the reason when the payment is REJECTED', async ({ page }) => {
    const fake = await openPayment(page, inVerification);
    await expect(outcome(page).getByRole('heading')).toHaveText('Comprobante en verificación');

    await operatorDecides(page, fake, { estado: 'REJECTED', motivo_rechazo: 'El comprobante no se puede leer' });

    await expect(outcome(page).getByRole('heading')).toHaveText('Pago rechazado');
    await expect(outcome(page)).toContainText('Motivo: El comprobante no se puede leer');
    await expect(outcome(page)).toContainText('Tus números se liberaron.');
    await expect(page.getByRole('link', { name: 'Volver a la rifa' }).last()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('says the refund is pending on REFUND_PENDING (DT-08)', async ({ page }) => {
    const fake = await openPayment(page, inVerification);

    await operatorDecides(page, fake, { estado: 'REFUND_PENDING', motivo_rechazo: 'El monto no coincide con el total' });

    await expect(outcome(page).getByRole('heading')).toHaveText('Pago rechazado');
    await expect(outcome(page)).toContainText('Motivo: El monto no coincide con el total');
    await expect(outcome(page)).toContainText('Tu reembolso está pendiente');
    await expectNoHorizontalScroll(page);
  });

  test('says an operator is reviewing on LATE_PAYMENT_REVIEW, with no refund promise (DT-10)', async ({ page }) => {
    const fake = await openPayment(page, inVerification);

    await operatorDecides(page, fake, { estado: 'LATE_PAYMENT_REVIEW' });

    await expect(outcome(page).getByRole('heading')).toHaveText('Pago en revisión');
    await expect(outcome(page)).toContainText('Un operador está revisando tu pago');
    await expect(outcome(page)).not.toContainText(/reembols/i);
    const reads = fake.reads;
    await page.clock.runFor(30_000);
    expect(fake.reads, 'polling stops at LATE_PAYMENT_REVIEW').toBe(reads);
    await expectNoHorizontalScroll(page);
  });

  test('reloaded on REFUNDED, says the money was returned and polls no more', async ({ page }) => {
    const fake = await openPayment(page, { ...inVerification, estado: 'REFUNDED', motivo_rechazo: 'Rifa cancelada' });

    await expect(outcome(page).getByRole('heading')).toHaveText('Pago reembolsado');
    await expect(outcome(page)).toContainText('Te devolvimos el dinero de esta orden.');
    await expect(page.getByRole('form')).toHaveCount(0);
    const reads = fake.reads;
    await page.clock.runFor(30_000);
    expect(fake.reads).toBe(reads);
    await expectNoHorizontalScroll(page);
  });

  test('reloaded on LATE_PAYMENT_DISMISSED, says the review was closed', async ({ page }) => {
    await openPayment(page, { ...inVerification, estado: 'LATE_PAYMENT_DISMISSED' });

    await expect(outcome(page).getByRole('heading')).toHaveText('Revisión cerrada');
    await expect(page.getByRole('form')).toHaveCount(0);
    await expect(timer(page)).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });

  test('reloaded on EXPIRED, returns to the grid and says the reservation lapsed', async ({ page }) => {
    await mockRaffle(page);
    await givenStoredSession(page);
    await page.clock.install({ time: LOCAL_START });
    await mockPayment(page, { estado: 'EXPIRED' });

    await page.goto(PAYMENT_URL);

    await expectBackOnTheGridWithNotice(page);
    await expectNoHorizontalScroll(page);
  });

  test('a 409 RESERVATION_EXPIRED on the upload returns to the grid with the notice', async ({ page }) => {
    await mockRaffle(page);
    const fake = await openPayment(page);
    await fillProof(page);
    fake.nextProofReply = { status: 409, body: apiError('RESERVATION_EXPIRED', 'Reservation expired') };

    await submitButton(page).click();

    await expectBackOnTheGridWithNotice(page);
    expect(fake.proofs).toHaveLength(1);
    await expectNoHorizontalScroll(page);
  });

  test('at zero waits for the server, then returns to the grid once it is past the deadline', async ({ page }) => {
    await mockRaffle(page);
    await openPayment(page);
    await expect(timer(page)).toHaveText(/^1[45]:\d\d$/);
    await expectNoHorizontalScroll(page);

    await page.clock.runFor(15 * 60_000 + 10_000);

    await expectBackOnTheGridWithNotice(page);
    await expectNoHorizontalScroll(page);
  });

  test('with no account to transfer to, says not to transfer and offers no proof form', async ({ page }) => {
    await givenStoredSession(page);
    await page.clock.install({ time: LOCAL_START });
    const fake = await mockPayment(page);
    fake.accountsReply = { status: 200, body: [] };
    await page.goto(PAYMENT_URL);

    await expect(accountsNotice(page)).toContainText('No transfieras todavía');
    await expect(page.getByRole('form')).toHaveCount(0);
    await expect(submitButton(page)).toHaveCount(0);
    await expect(timer(page)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('when the accounts cannot be read, says not to transfer and lets the buyer retry', async ({ page }) => {
    await givenStoredSession(page);
    await page.clock.install({ time: LOCAL_START });
    const fake = await mockPayment(page);
    fake.accountsReply = { status: 503, body: apiError('SERVICE_UNAVAILABLE', 'down') };
    await page.goto(PAYMENT_URL);

    await expect(accountsNotice(page)).toContainText('No transfieras todavía');
    await expect(page.getByRole('form')).toHaveCount(0);
    await expectNoHorizontalScroll(page);

    fake.accountsReply = { status: 200, body: paymentAccountDtos() };
    await accountsNotice(page).getByRole('button', { name: 'Reintentar' }).click();

    await expect(page.getByRole('list', { name: 'Cuentas de pago' }).getByRole('listitem')).toHaveCount(2);
    await expect(page.getByRole('form')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('explains upload errors and keeps the form: size, type and rate limit', async ({ page }) => {
    const fake = await openPayment(page);
    await fillProof(page, { file: false });

    // Over the 5 MB limit: refused before sending anything.
    await page.getByLabel('Subir foto o PDF del comprobante').setInputFiles({
      name: 'huge.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    });
    await submitButton(page).click();
    await expect(page.getByText('El archivo pesa más de 5 MB.')).toBeVisible();
    await expect(page.getByLabel('Subir foto o PDF del comprobante')).toHaveAttribute('aria-invalid', 'true');
    expect(fake.proofs).toHaveLength(0);
    await expectNoHorizontalScroll(page);

    await page.getByLabel('Subir foto o PDF del comprobante').setInputFiles(PNG_PROOF);
    fake.nextProofReply = { status: 413, body: apiError('PAYLOAD_TOO_LARGE', 'File too large') };
    await submitButton(page).click();
    const alert = page.getByRole('form').getByRole('alert');
    await expect(alert).toHaveText('El archivo es demasiado grande. Sube uno de hasta 5 MB.');

    fake.nextProofReply = { status: 422, body: apiError('INVALID_PAYMENT_PROOF', 'Proof file must be a PNG, JPEG, WEBP or PDF') };
    await submitButton(page).click();
    await expect(alert).toHaveText('El comprobante no es válido. Sube una imagen PNG, JPEG o WEBP, o un PDF de hasta 5 MB.');

    fake.nextProofReply = { status: 429, body: apiError('TOO_MANY_REQUESTS', 'ThrottlerException: Too Many Requests') };
    await submitButton(page).click();
    await expect(alert).toHaveText('Hiciste demasiados intentos. Espera unos minutos e inténtalo de nuevo.');

    expect(fake.proofs).toHaveLength(3);
    await expect(submitButton(page)).toBeEnabled();
    await expect(timer(page)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("answers another buyer's order (404) as an order that does not exist", async ({ page }) => {
    await givenStoredSession(page);
    await page.clock.install({ time: LOCAL_START });
    const fake = await mockPayment(page);
    fake.readReply = { status: 404, body: apiError('ORDER_NOT_FOUND', `Order ${ORDER_ID} not found`) };
    await page.goto(PAYMENT_URL);

    await expect(page.getByRole('alert')).toContainText('No encontramos esta orden.');
    await expect(page.getByRole('link', { name: 'Volver a la rifa' }).last()).toHaveAttribute('href', `/rifas/${RAFFLE_ID}`);
    await expect(page.getByRole('form')).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});
