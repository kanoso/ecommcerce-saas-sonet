import { Locator, Page, expect, test } from '@playwright/test';
import { apiError, mockActiveRaffles, raffleDto } from './support/api-mock';
import { LINK_TOKEN, givenStoredSession, mockOpenSession, mockRequestLink } from './support/auth-mock';
import { expectNoHorizontalScroll } from './support/no-horizontal-scroll';
import { LOCAL_START, mockPayment } from './support/payment-mock';
import {
  COMMITMENT_HASH,
  ORDER_ID,
  RAFFLE_ID,
  mockRaffle,
  mockReservation,
  orderDto,
  ticketsUnavailable,
} from './support/raffle-mock';

const RAFFLE_URL = `/rifas/${RAFFLE_ID}`;

const cell = (page: Page, number: string) => page.getByRole('button', { name: new RegExp(`^Número ${number},`) });
const reserveButton = (page: Page) => page.getByRole('button', { name: 'Reservar 15 min' });
const bottomBar = (page: Page) => page.getByRole('region', { name: 'Tu selección' });
const gridCells = (page: Page) => page.getByRole('group', { name: 'Números del rango' }).getByRole('button');
const notice = (page: Page) => bottomBar(page).getByRole('status');

async function expectTouchTarget(control: Locator): Promise<void> {
  const box = await control.boundingBox();
  expect(box, 'control has a layout box').not.toBeNull();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
}

test.describe('Raffle detail (/rifas/:id)', () => {
  test('shows the raffle, its commitment and the grid by ranges', async ({ page }) => {
    await mockRaffle(page, { numberMax: 1000, statuses: { 3: 'RESERVED', 4: 'SOLD', 6: 'UNAVAILABLE' } });
    await page.goto(RAFFLE_URL);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Smart TV 55"');
    await expect(page.getByText(`sha256: ${COMMITMENT_HASH}`)).toBeVisible();
    await expect(page.getByText('ronda drand #5,204,117')).toBeVisible();
    await expect(gridCells(page)).toHaveCount(42);
    await expect(cell(page, '0003')).toBeDisabled();
    await expect(cell(page, '0003')).toHaveAccessibleName('Número 0003, reservado');
    await expect(cell(page, '0004')).toHaveAccessibleName('Número 0004, vendido');
    await expect(cell(page, '0006')).toHaveAccessibleName('Número 0006, no disponible');
    const legend = page.getByRole('list', { name: 'Estados de los números' });
    for (const state of ['Disponible', 'Tu elección', 'Reservado', 'Vendido', 'No disponible']) {
      await expect(legend).toContainText(state);
    }
    await expect(reserveButton(page)).toBeDisabled();
    await expectTouchTarget(cell(page, '0001'));
    await expectTouchTarget(page.getByRole('button', { name: '0001–0042' }));
    await expect(reserveButton(page)).toHaveCSS('min-height', '48px');
    await expectNoHorizontalScroll(page);

    // 24 ranges scroll inside their strip, not the page.
    await page.getByRole('button', { name: '0043–0084' }).click();
    await expect(gridCells(page).first()).toHaveText('0043');
    await expectNoHorizontalScroll(page);
  });

  test('selects numbers and reserves them, then opens the payment page', async ({ page }) => {
    await givenStoredSession(page);
    await page.clock.install({ time: LOCAL_START });
    await mockRaffle(page);
    await mockPayment(page);
    const requests = await mockReservation(page, (body) => ({ status: 201, body: orderDto(body.numeros) }));
    await page.goto(RAFFLE_URL);

    await cell(page, '007').click();
    await cell(page, '023').click();
    await expect(cell(page, '007')).toHaveAttribute('aria-pressed', 'true');
    await expect(bottomBar(page)).toContainText('2 números elegidos');
    // Intl separates the currency with a no-break space.
    await expect(bottomBar(page)).toContainText(/S\/\s20\.00/);
    await expectNoHorizontalScroll(page);

    await reserveButton(page).click();

    await expect(page).toHaveURL(new RegExp(`/rifas/${RAFFLE_ID}/pago/${ORDER_ID}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Pagar boletos' })).toBeVisible();
    // Server clock (15 min left), not the phone's (12); the clock flows, so allow drift.
    await expect(page.getByRole('timer', { name: 'Tiempo restante de la reserva' })).toHaveText(/^1[45]:\d\d$/);
    expect(requests).toHaveLength(1);
    expect(requests[0].postDataJSON()).toEqual({ rifa_id: RAFFLE_ID, numeros: [7, 23] });
    expect(await requests[0].headerValue('authorization')).toBe('Bearer stored-token');
    await expectNoHorizontalScroll(page);
  });

  test('on 409 shows the lost numbers the API lists and keeps the rest selected', async ({ page }) => {
    await givenStoredSession(page);
    const raffle = await mockRaffle(page);
    await mockReservation(page, () => {
      // Someone else reserved 7 a moment before.
      raffle.statuses[7] = 'RESERVED';
      return { status: 409, body: ticketsUnavailable([7]) };
    });
    await page.goto(RAFFLE_URL);

    await cell(page, '007').click();
    await cell(page, '023').click();
    await reserveButton(page).click();

    await expect(notice(page)).toHaveText(
      'No se completó la reserva. El número 007 ya no está disponible y lo quitamos de tu selección.',
    );
    await expect(cell(page, '007')).toBeDisabled();
    await expect(cell(page, '007')).toHaveAccessibleName('Número 007, reservado');
    await expect(cell(page, '023')).toHaveAttribute('aria-pressed', 'true');
    await expect(bottomBar(page)).toContainText('1 número elegido');
    await expect(page).toHaveURL(new RegExp(`${RAFFLE_URL}$`));
    await expectNoHorizontalScroll(page);
  });

  test('on 409 names the listed numbers even when the grid cannot be read again', async ({ page }) => {
    await givenStoredSession(page);
    const raffle = await mockRaffle(page);
    await mockReservation(page, () => ({ status: 409, body: ticketsUnavailable([7]) }));
    await page.goto(RAFFLE_URL);
    await cell(page, '007').click();
    await cell(page, '023').click();
    raffle.failReads = true;

    await reserveButton(page).click();

    await expect(notice(page)).toHaveText(
      'No se completó la reserva. El número 007 ya no está disponible y lo quitamos de tu selección.',
    );
    await expect(cell(page, '007')).toHaveAccessibleName('Número 007, no disponible');
    await expect(cell(page, '023')).toHaveAttribute('aria-pressed', 'true');
    await expectNoHorizontalScroll(page);
  });

  test('on 409 without the list, reads the grid again to find the lost numbers', async ({ page }) => {
    await givenStoredSession(page);
    const raffle = await mockRaffle(page);
    await mockReservation(page, () => {
      raffle.statuses[7] = 'RESERVED';
      return {
        status: 409,
        body: apiError('TICKETS_UNAVAILABLE', 'Ticket numbers 7 are not available for reservation'),
      };
    });
    await page.goto(RAFFLE_URL);

    await cell(page, '007').click();
    await cell(page, '023').click();
    await reserveButton(page).click();

    await expect(notice(page)).toHaveText(
      'No se completó la reserva. El número 007 ya no está disponible y lo quitamos de tu selección.',
    );
    await expect(cell(page, '007')).toBeDisabled();
    await expect(cell(page, '007')).toHaveAccessibleName('Número 007, reservado');
    await expect(cell(page, '023')).toHaveAttribute('aria-pressed', 'true');
    await expect(bottomBar(page)).toContainText('1 número elegido');
    await expect(page).toHaveURL(new RegExp(`${RAFFLE_URL}$`));
    await expectNoHorizontalScroll(page);
  });

  test('explains a 429 and keeps the selection', async ({ page }) => {
    await givenStoredSession(page);
    await mockRaffle(page);
    await mockReservation(page, () => ({ status: 429, body: apiError('TOO_MANY_REQUESTS', 'ThrottlerException') }));
    await page.goto(RAFFLE_URL);

    await cell(page, '007').click();
    await reserveButton(page).click();

    await expect(page.getByRole('alert')).toHaveText(
      'Hiciste demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
    );
    await expect(cell(page, '007')).toHaveAttribute('aria-pressed', 'true');
    await expectNoHorizontalScroll(page);
  });

  test('polls every 5 seconds and drops a number someone else took', async ({ page }) => {
    await page.clock.install();
    const raffle = await mockRaffle(page);
    await page.goto(RAFFLE_URL);

    await cell(page, '007').click();
    await cell(page, '023').click();
    const readsBefore = raffle.pagesRead.length;
    raffle.statuses[7] = 'SOLD';

    await page.clock.runFor(5000);

    await expect(notice(page)).toHaveText(
      'El número 007 ya no está disponible y lo quitamos de tu selección.',
    );
    await expect(cell(page, '007')).toHaveAccessibleName('Número 007, vendido');
    await expect(cell(page, '023')).toHaveAttribute('aria-pressed', 'true');
    expect(raffle.pagesRead.length).toBeGreaterThan(readsBefore);
    await expectNoHorizontalScroll(page);
  });

  test('sends a signed-out buyer to sign in and back to the raffle', async ({ page }) => {
    await mockRaffle(page);
    await mockRequestLink(page);
    await mockOpenSession(page);
    await page.goto(RAFFLE_URL);

    await cell(page, '007').click();
    await reserveButton(page).click();

    await expect(page).toHaveURL(new RegExp(`/ingresar\\?volver=%2Frifas%2F${RAFFLE_ID}$`));
    await page.getByLabel('Correo electrónico').fill('ana@example.com');
    await page.getByRole('button', { name: 'Enviarme el enlace' }).click();
    await expect(page.getByRole('status')).toContainText('Revisa tu correo');
    await expectNoHorizontalScroll(page);

    // The buyer opens the emailed link.
    await page.goto(`/acceso#token=${LINK_TOKEN}`);

    await expect(page).toHaveURL(new RegExp(`${RAFFLE_URL}$`));
    await expect(page.getByRole('button', { name: 'Salir' })).toBeVisible();
    await expect(cell(page, '007')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('never returns to an outside address after signing in', async ({ page }) => {
    await mockActiveRaffles(page, []);
    await mockRequestLink(page);
    await mockOpenSession(page);
    await page.goto('/ingresar?volver=https%3A%2F%2Fevil.example%2F');

    await page.getByLabel('Correo electrónico').fill('ana@example.com');
    await page.getByRole('button', { name: 'Enviarme el enlace' }).click();
    await expect(page.getByRole('status')).toContainText('Revisa tu correo');
    await page.goto(`/acceso#token=${LINK_TOKEN}`);

    await expect(page).toHaveURL('http://localhost:4200/');
    await expectNoHorizontalScroll(page);
  });

  test('the payment page asks a signed-out buyer to sign in first', async ({ page }) => {
    await mockRaffle(page);
    const paymentUrl = `/rifas/${RAFFLE_ID}/pago/${ORDER_ID}`;

    await page.goto(paymentUrl);

    await expect(page).toHaveURL(new RegExp(`/ingresar\\?volver=${encodeURIComponent(paymentUrl)}$`));
    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('the catalog card opens the raffle', async ({ page }) => {
    await mockActiveRaffles(page, [raffleDto({ numero_max: 100 })]);
    await mockRaffle(page);
    await page.goto('/');

    await page.getByRole('link', { name: 'Elegir números' }).click();

    await expect(page).toHaveURL(new RegExp(`${RAFFLE_URL}$`));
    await expect(page.getByRole('heading', { name: 'Elige tus números' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
