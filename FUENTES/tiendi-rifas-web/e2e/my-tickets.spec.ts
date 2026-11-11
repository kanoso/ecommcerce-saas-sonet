import { Page, expect, test } from '@playwright/test';
import { apiError, mockActiveRaffles } from './support/api-mock';
import { LINK_TOKEN, givenStoredSession, mockOpenSession, mockRequestLink } from './support/auth-mock';
import { OTHER_RAFFLE_ID, mixedTicketDtos, mockMyTickets, myTicketDto } from './support/my-tickets-mock';
import { expectNoHorizontalScroll } from './support/no-horizontal-scroll';
import { LOCAL_START, mockPayment } from './support/payment-mock';
import { ORDER_ID, RAFFLE_ID, mockRaffle } from './support/raffle-mock';

const TV = 'Smart TV 55 pulgadas';
const MOTO = 'Moto 150cc';

const raffleSection = (page: Page, title: string) => page.getByRole('region', { name: title });
/** The orders of a raffle: the list items that hold a list of numbers. */
const orders = (page: Page, title: string) =>
  raffleSection(page, title)
    .getByRole('listitem')
    .filter({ has: page.getByRole('list', { name: 'Números' }) });
const payLinks = (page: Page) => page.getByRole('link', { name: /^Completar pago/ });

test.describe('Mis boletos (RF-06)', () => {
  test('lists the orders by raffle with their status, total and deadline', async ({ page }) => {
    await givenStoredSession(page);
    await page.clock.install({ time: LOCAL_START });
    await mockActiveRaffles(page, []);
    // The list alone carries every deadline: no order is read one by one.
    const orderReads: string[] = [];
    await page.route(
      (url) => url.pathname.startsWith('/api/ordenes/'),
      (route) => {
        orderReads.push(route.request().url());
        return route.fulfill({ status: 500, body: '{}' });
      },
    );
    const fake = await mockMyTickets(page, mixedTicketDtos());

    await page.goto('/');
    await page.getByRole('link', { name: 'Mis boletos' }).click();

    await expect(page).toHaveURL(/\/mis-boletos$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Mis boletos' })).toBeVisible();
    // The raffle with an order to pay comes first.
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([TV, MOTO]);

    const tv = orders(page, TV);
    await expect(tv).toHaveCount(2);
    await expect(tv.nth(0).getByRole('list', { name: 'Números' }).getByRole('listitem')).toHaveText(['7', '23']);
    await expect(tv.nth(0)).toContainText('Pendiente de pago');
    await expect(tv.nth(0)).toContainText(/Total S\/\s20\.00/);
    // 15:15 UTC on the server is 10:15 in Lima.
    await expect(tv.nth(0)).toContainText(/Paga antes del 3 nov\.?,? 10:15/);
    await expect(tv.nth(1)).toContainText('Pago rechazado');

    const moto = orders(page, MOTO);
    await expect(moto.nth(0)).toContainText('Pago aprobado');
    await expect(moto.nth(0)).toContainText(/Total S\/\s15\.50/);
    await expect(moto.nth(1)).toContainText('Comprobante en verificación');
    await expect(page.getByRole('link', { name: `Ver rifa ${MOTO}` })).toHaveAttribute('href', `/rifas/${OTHER_RAFFLE_ID}`);

    // Only the order awaiting its proof can still be paid.
    await expect(payLinks(page)).toHaveCount(1);
    expect(fake.authorizations).toEqual(['Bearer stored-token']);
    expect(orderReads).toEqual([]);
    await expectNoHorizontalScroll(page);
  });

  test('takes an order awaiting its proof to the payment screen', async ({ page }) => {
    await givenStoredSession(page);
    await page.clock.install({ time: LOCAL_START });
    await mockPayment(page);
    await mockMyTickets(page, mixedTicketDtos());

    await page.goto('/mis-boletos');
    await page.getByRole('link', { name: `Completar pago de ${TV}, números 7, 23` }).click();

    await expect(page).toHaveURL(new RegExp(`/rifas/${RAFFLE_ID}/pago/${ORDER_ID}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Pagar boletos' })).toBeVisible();
    await expect(page.getByRole('timer', { name: 'Tiempo restante de la reserva' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('takes an expired order to the late payment claim screen', async ({ page }) => {
    await givenStoredSession(page);
    await page.clock.install({ time: LOCAL_START });
    await mockPayment(page, { estado: 'EXPIRED' });
    await mockMyTickets(page, [
      myTicketDto({
        orden_id: ORDER_ID,
        estado: 'EXPIRED',
        monto_total: 20,
      }),
    ]);

    await page.goto('/mis-boletos');
    await page.getByRole('link', { name: `Reclamar pago de ${TV}, números 7, 23` }).click();

    await expect(page).toHaveURL(new RegExp(`/rifas/${RAFFLE_ID}/pago/${ORDER_ID}/reclamo$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Reclamar pago tardío' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('says so when the buyer has no tickets and offers the catalog', async ({ page }) => {
    await givenStoredSession(page);
    await mockMyTickets(page, []);
    await mockActiveRaffles(page, []);

    await page.goto('/mis-boletos');

    await expect(page.getByText('Aún no tienes boletos.')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole('link', { name: 'Ver rifas activas' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expectNoHorizontalScroll(page);
  });

  test('shows the error and retries', async ({ page }) => {
    await givenStoredSession(page);
    const fake = await mockMyTickets(page, apiError('SERVICE_UNAVAILABLE', 'Down'), 503);

    await page.goto('/mis-boletos');

    await expect(page.getByRole('alert')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect.poll(() => fake.reads).toBe(2);
    await expect(page.getByRole('alert')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('sends a signed-out buyer to sign in and back to the tickets', async ({ page }) => {
    await mockRequestLink(page);
    await mockOpenSession(page);
    await mockMyTickets(page, mixedTicketDtos());
    await mockRaffle(page);

    await page.goto('/mis-boletos');

    await expect(page).toHaveURL(/\/ingresar\?volver=%2Fmis-boletos$/);
    await expect(page.getByRole('link', { name: 'Mis boletos' })).toHaveCount(0);
    await page.getByLabel('Correo electrónico').fill('ana@example.com');
    await page.getByRole('button', { name: 'Enviarme el enlace' }).click();
    await expect(page.getByRole('status')).toContainText('Revisa tu correo');
    await expectNoHorizontalScroll(page);

    // The buyer opens the emailed link.
    await page.goto(`/acceso#token=${LINK_TOKEN}`);

    await expect(page).toHaveURL(/\/mis-boletos$/);
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([TV, MOTO]);
    await expectNoHorizontalScroll(page);
  });
});
