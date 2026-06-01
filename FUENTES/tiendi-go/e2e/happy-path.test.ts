// Requires: dev build via EAS, test backend running at localhost:3000 with seed data
import { device, element, by, expect as detoxExpect, waitFor } from 'detox';
import { loginAs } from './helpers/auth';

beforeAll(async () => {
  await device.launchApp({ newInstance: true });
  await loginAs();
});

afterAll(async () => {
  await device.terminateApp();
});

describe('Happy path — complete delivery flow', () => {
  it('goes online', async () => {
    await element(by.id('go-online-btn')).tap();
    await waitFor(element(by.id('status-online'))).toBeVisible().withTimeout(15000);
  });

  it('receives and accepts an offer', async () => {
    await waitFor(element(by.id('offer-card'))).toBeVisible().withTimeout(60000);
    await element(by.id('accept-offer-btn')).tap();
    await waitFor(element(by.id('delivery-screen'))).toBeVisible().withTimeout(15000);
  });

  it('confirms pickup via manual code', async () => {
    await element(by.id('pickup-btn')).tap();
    await element(by.id('pickup-manual-tab')).tap();
    await element(by.id('pickup-code-input')).typeText('1234');
    await element(by.id('confirm-pickup-btn')).tap();
    await waitFor(element(by.id('status-en-camino-cliente'))).toBeVisible().withTimeout(15000);
  });

  it('delivers to customer via POD and returns home', async () => {
    await element(by.id('pod-btn')).tap();
    await element(by.id('pod-otp-input')).typeText('0000');
    await element(by.id('confirm-pod-btn')).tap();
    await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(15000);
  });
});
