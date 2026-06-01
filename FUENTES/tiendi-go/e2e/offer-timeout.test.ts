// Requires: test backend to inject an offer for the test rider after they go online
import { device, element, by, expect as detoxExpect, waitFor } from 'detox';
import { loginAs } from './helpers/auth';

beforeAll(async () => {
  await device.launchApp({ newInstance: true });
  await loginAs();
});

afterAll(async () => {
  await device.terminateApp();
});

describe('Offer timeout — card disappears after 30s', () => {
  it('goes online and waits for an offer', async () => {
    await element(by.id('go-online-btn')).tap();
    await waitFor(element(by.id('status-online'))).toBeVisible().withTimeout(15000);
    await waitFor(element(by.id('offer-card'))).toBeVisible().withTimeout(60000);
  });

  it('shows the countdown timer on the offer card', async () => {
    await detoxExpect(element(by.id('offer-timer'))).toBeVisible();
  });

  it('removes the offer card after timeout and returns to idle', async () => {
    await new Promise((r) => setTimeout(r, 31000));
    await detoxExpect(element(by.id('offer-card'))).not.toBeVisible();
    await detoxExpect(element(by.id('home-screen'))).toBeVisible();
  });
});
