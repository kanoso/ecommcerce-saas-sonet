import { expect, test } from '@playwright/test';
import { mockActiveRaffles } from './support/api-mock';
import { expectNoHorizontalScroll } from './support/no-horizontal-scroll';

test('has title, without horizontal scroll', async ({ page }) => {
  await mockActiveRaffles(page, []);
  await page.goto('/');
  await expect(page).toHaveTitle(/Plataforma de Rifas/);
  await expectNoHorizontalScroll(page);
});
