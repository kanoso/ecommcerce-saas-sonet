// test-delivery-id must exist in the test database in EN_DESTINO state
import { device, element, by, expect as detoxExpect, waitFor } from 'detox';
import { loginAs } from './helpers/auth';

beforeAll(async () => {
  await device.launchApp({ newInstance: true });
  await loginAs();
  await device.openURL({ url: 'tiendigo://delivery/test-delivery-id' });
  await waitFor(element(by.id('delivery-screen'))).toBeVisible().withTimeout(15000);
  await waitFor(element(by.id('pod-btn'))).toBeVisible().withTimeout(15000);
});

afterAll(async () => {
  await device.terminateApp();
});

describe('POD — wrong OTP then correct OTP', () => {
  it('shows error on wrong OTP', async () => {
    await element(by.id('pod-btn')).tap();
    await element(by.id('pod-otp-input')).typeText('9999');
    await element(by.id('confirm-pod-btn')).tap();
    await waitFor(element(by.id('pod-error-msg'))).toBeVisible().withTimeout(15000);
  });

  it('completes delivery with correct OTP', async () => {
    await element(by.id('pod-otp-input')).clearText();
    await element(by.id('pod-otp-input')).typeText('0000');
    await element(by.id('confirm-pod-btn')).tap();
    await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(15000);
  });
});
