import { Page } from '@playwright/test';

/** Mirrors SESSION_STORAGE_KEY of src/app/core/session/session.store.ts. */
export const SESSION_STORAGE_KEY = 'tiendi-rifas.session';

export const LINK_TOKEN = 'A'.repeat(43);

const json = (body: unknown) => ({ contentType: 'application/json', body: JSON.stringify(body) });

/** `POST /api/auth/sesion` response (spec §11, Sesión). */
export const sessionDto = (overrides: Record<string, unknown> = {}) => ({
  token_acceso: 'access-token',
  vence_en: '2099-01-01T00:00:00.000Z',
  usuario: { usuario_id: 'u-1', email: 'ana@example.com', rol: 'BUYER' },
  ...overrides,
});

/** `POST /api/auth/enlace`: 202 by default, or the given error. */
export async function mockRequestLink(page: Page, status = 202, body: unknown = { enviado: true }): Promise<void> {
  await page.route('**/api/auth/enlace', (route) => route.fulfill({ status, ...json(body) }));
}

/** `POST /api/auth/sesion`: a session by default, or the given error. */
export async function mockOpenSession(page: Page, status = 200, body: unknown = sessionDto()): Promise<void> {
  await page.route('**/api/auth/sesion', (route) => route.fulfill({ status, ...json(body) }));
}

/** Starts the page already signed in, as after an earlier visit. */
export async function givenStoredSession(page: Page): Promise<void> {
  const stored = {
    accessToken: 'stored-token',
    expiresAt: '2099-01-01T00:00:00.000Z',
    user: { id: 'u-1', email: 'ana@example.com', role: 'BUYER' },
  };
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [SESSION_STORAGE_KEY, JSON.stringify(stored)] as const,
  );
}

export const storedSession = (page: Page) =>
  page.evaluate((key) => window.localStorage.getItem(key), SESSION_STORAGE_KEY);

export async function givenStoredAdminSession(page: Page): Promise<void> {
  const stored = {
    accessToken: 'stored-admin-token',
    expiresAt: '2099-01-01T00:00:00.000Z',
    user: { id: 'u-admin-1', email: 'admin@example.com', role: 'admin' },
  };
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [SESSION_STORAGE_KEY, JSON.stringify(stored)] as const,
  );
}
