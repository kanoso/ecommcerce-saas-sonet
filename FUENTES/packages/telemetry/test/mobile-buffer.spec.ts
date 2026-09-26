import { MobileLogBuffer } from '../src/mobile';

const EVENT = { level: 'ERROR' as const, message: 'fallo offline' };

describe('buffer mobile (T1: sin SDK OTel en RN)', () => {
  it('cola acotada: descarta el mas viejo al exceder maxSize', () => {
    const buffer = new MobileLogBuffer({ maxSize: 3, ttlMs: 60_000 });
    for (let i = 0; i < 5; i++) buffer.push({ ...EVENT, message: `m${i}` }, i * 1000);
    const batches = buffer.drain(5000);
    const flat = batches.flat();
    // m0/m1 descartados por FIFO; ttl no vencido.
    expect(flat.map((e) => e.message)).toEqual(['m2', 'm3', 'm4']);
  });

  it('TTL: eventos vencidos se descartan, no se envian', () => {
    const buffer = new MobileLogBuffer({ maxSize: 10, ttlMs: 1000 });
    buffer.push(EVENT, 0);
    buffer.push({ ...EVENT, message: 'nuevo' }, 1500);
    const flat = buffer.drain(1600).flat();
    expect(flat.map((e) => e.message)).toEqual(['nuevo']);
  });

  it('push sanea: texto con senuelo no sale intacto', () => {
    const buffer = new MobileLogBuffer({ maxSize: 5 });
    buffer.push({ level: 'ERROR', message: 'fallo con usuario@acme.com' });
    const flat = buffer.drain().flat();
    expect(flat[0]!.message).not.toContain('usuario@acme.com');
  });

  it('flush sin URL configurada: 0 enviados, sin errores', async () => {
    const buffer = new MobileLogBuffer();
    buffer.push(EVENT);
    await expect(buffer.flush(fetch)).resolves.toBe(0);
  });

  it('flush envia lotes acotados y drena la cola', async () => {
    const posts: Array<{ url: string; body: string }> = [];
    const fakeFetch = (async (url: string, init?: { body?: string }) => {
      posts.push({ url, body: init?.body ?? '' });
      return { ok: true } as Response;
    }) as unknown as typeof fetch;

    const buffer = new MobileLogBuffer({ maxSize: 45, batchSize: 20, flushUrl: 'https://gw/v1/logs' });
    for (let i = 0; i < 45; i++) buffer.push({ ...EVENT, message: `m${i}` }, i * 10);
    await expect(buffer.flush(fakeFetch, 60_000)).resolves.toBe(45);
    expect(posts.length).toBe(3); // 20 + 20 + 5
    expect(posts[0]!.url).toBe('https://gw/v1/logs');
    expect(buffer.size()).toBe(0);
  });

  it('fallo de red no reintenta en bucle: eventos se pierden (no es transaccional)', async () => {
    let calls = 0;
    const failing = (async () => {
      calls++;
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const buffer = new MobileLogBuffer({ flushUrl: 'https://gw/v1/logs', batchSize: 100 });
    buffer.push(EVENT);
    await expect(buffer.flush(failing)).resolves.toBe(0);
    expect(calls).toBe(1);
    expect(buffer.size()).toBe(0);
  });
});
