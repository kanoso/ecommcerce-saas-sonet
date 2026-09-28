import { withTimeout } from '../src/time';

describe('withTimeout (guia T1: shutdown/flush acotado)', () => {
  it('resuelve el resultado cuando la promesa termina antes del plazo', async () => {
    const start = Date.now();
    await expect(withTimeout(Promise.resolve('ok'), 1000)).resolves.toBeUndefined();
    expect(Date.now() - start).toBeLessThan(900);
  });

  it('resuelve en el plazo aunque la promesa subyacente cuelgue (no supera el timeout)', async () => {
    const start = Date.now();
    await expect(
      withTimeout(new Promise(() => undefined), 50),
    ).resolves.toBeUndefined();
    expect(Date.now() - start).toBeLessThan(900);
  });

  it('una promesa rechazada no rompe el shutdown: se resuelve igual', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('falla telemetria')), 1000),
    ).resolves.toBeUndefined();
  });
});
