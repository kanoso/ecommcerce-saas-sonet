import { expect, test } from '@playwright/test';
import { apiError, mockActiveRaffles, raffleDto } from './support/api-mock';
import {
  LINK_TOKEN,
  givenStoredSession,
  mockOpenSession,
  mockRequestLink,
  storedSession,
} from './support/auth-mock';
import { expectNoHorizontalScroll } from './support/no-horizontal-scroll';

test.describe('Magic-link sign-in', () => {
  test('requests a link without horizontal scroll', async ({ page }) => {
    await mockRequestLink(page);
    await page.goto('/ingresar');
    await page.getByLabel('Correo electrónico').fill('ana@example.com');
    await page.getByRole('button', { name: 'Enviarme el enlace' }).click();
    await expect(page.getByRole('status')).toContainText('Revisa tu correo');
    await expectNoHorizontalScroll(page);
  });

  test('explains a 429 on the request form and lets the buyer retry later', async ({ page }) => {
    await mockRequestLink(page, 429, apiError('TOO_MANY_REQUESTS', 'Too many requests'));
    await page.goto('/ingresar');
    await page.getByLabel('Correo electrónico').fill('ana@example.com');
    await page.getByRole('button', { name: 'Enviarme el enlace' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      'Hiciste demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
    );
    await expect(page.getByRole('button', { name: 'Enviarme el enlace' })).toBeEnabled();
    await expectNoHorizontalScroll(page);
  });

  test('opens the session from the emailed link and shows the account', async ({ page }) => {
    await mockActiveRaffles(page, []);
    await mockOpenSession(page);
    await page.goto(`/acceso#token=${LINK_TOKEN}`);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Salir' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('explains an invalid or used link and drops its token from the address', async ({ page }) => {
    await mockOpenSession(page, 401, apiError('MAGIC_LINK_INVALID', 'Invalid link'));
    await page.goto(`/acceso#token=${LINK_TOKEN}`);
    await expect(page.getByRole('alert')).toHaveText('El enlace no es válido o ya fue usado. Pide uno nuevo.');
    await expect(page).toHaveURL(/\/acceso$/);
    expect(page.url()).not.toContain(LINK_TOKEN);
    await expect(page.getByRole('link', { name: 'Pedir un enlace nuevo' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ingresar' })).toBeVisible();
    expect(await storedSession(page)).toBeNull();
    await expectNoHorizontalScroll(page);
  });

  test('forgets the session when the API answers 401', async ({ page }) => {
    await givenStoredSession(page);
    await mockActiveRaffles(page, apiError('UNAUTHORIZED', 'No session'), 401);
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Ingresar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salir' })).toHaveCount(0);
    expect(await storedSession(page)).toBeNull();
    await expectNoHorizontalScroll(page);
  });

  test('keeps a stored session while the API accepts it', async ({ page }) => {
    await givenStoredSession(page);
    await mockActiveRaffles(page, [raffleDto()]);
    await page.goto('/');
    await expect(page.locator('article')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Salir' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
