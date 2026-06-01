import { device, element, by, expect as detoxExpect } from 'detox';

const TEST_EMAIL = 'carlos.quispe@rider.test';
const TEST_PASSWORD = 'Rider2024!';

export async function loginAs(email = TEST_EMAIL, password = TEST_PASSWORD): Promise<void> {
  await device.reloadReactNative();
  await detoxExpect(element(by.id('email-input'))).toBeVisible();
  await element(by.id('email-input')).typeText(email);
  await element(by.id('password-input')).typeText(password);
  await element(by.id('login-btn')).tap();
  await detoxExpect(element(by.id('home-screen'))).toBeVisible();
}
