import { GatewayLogBatcher } from '../src/browser';

const EVENT = {
  level: 'ERROR',
  message: 'click fallo usuario@acme.com',
  eventName: 'browser.error',
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
  spanId: '00f067aa0ba902b7',
};

const makeFetch = (ok = true, status = 202) => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const impl = (async (url: string, init?: { body?: string }) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body) : undefined });
    return { ok, status } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
};

describe('GatewayLogBatcher (T5: browser -> gateway JSON)', () => {
  it('flush envia el lote con service/events y drena la cola', async () => {
    const { impl, calls } = makeFetch();
    const batcher = new GatewayLogBatcher('https://api.tiendi.pe/api/v1/telemetry/client-logs', {
      maxSize: 10,
      flushIntervalMs: 999_999,
    });
    batcher.push(EVENT);
    await expect(batcher.flushNow(impl)).resolves.toBe(1);
    expect(calls[0]!.url).toContain('/telemetry/client-logs');
    expect(calls[0]!.body).toMatchObject({ events: [EVENT] });
    expect(batcher.size()).toBe(0);
  });

  it('cola acotada: descarta el mas viejo', () => {
    const batcher = new GatewayLogBatcher('https://gw', { maxSize: 2 });
    batcher.push({ ...EVENT, message: 'a' });
    batcher.push({ ...EVENT, message: 'b' });
    batcher.push({ ...EVENT, message: 'c' });
    expect(batcher.size()).toBe(2);
  });

  it('cola vacia: flush es no-op', async () => {
    const { impl, calls } = makeFetch();
    const batcher = new GatewayLogBatcher('https://gw');
    await expect(batcher.flushNow(impl)).resolves.toBe(0);
    expect(calls).toEqual([]);
  });

  it('fallo de red: eventos se descartan sin reintentar en bucle', async () => {
    let calls = 0;
    const failing = (async () => {
      calls++;
      throw new Error('down');
    }) as unknown as typeof fetch;
    const batcher = new GatewayLogBatcher('https://gw');
    batcher.push(EVENT);
    await expect(batcher.flushNow(failing)).resolves.toBe(0);
    expect(calls).toBe(1);
    expect(batcher.size()).toBe(0);
  });

  it('respuesta 429/500: descarte, sin reintento automatico', async () => {
    const { impl, calls } = makeFetch(false, 429);
    const batcher = new GatewayLogBatcher('https://gw');
    batcher.push(EVENT);
    await expect(batcher.flushNow(impl)).resolves.toBe(0);
    expect(calls.length).toBe(1);
  });
});
