import { createPinoOtelStream } from '../src/node/pino-otel';

describe('bridge Pino -> OTel (T1)', () => {
  const makeStream = () => {
    const emitted: unknown[] = [];
    return { stream: createPinoOtelStream((e) => emitted.push(e)), emitted };
  };

  it('mapea niveles pino (60 fatal → ERROR, 30 info → INFO)', () => {
    const { stream, emitted } = makeStream();
    stream.write(JSON.stringify({ level: 60, msg: 'fatal' }));
    stream.write(JSON.stringify({ level: 50, msg: 'err' }));
    stream.write(JSON.stringify({ level: 30, msg: 'ok' }));
    expect(emitted.map((e) => (e as { level: string }).level)).toEqual([
      'ERROR',
      'ERROR',
      'INFO',
    ]);
  });

  it('extrae err del registro como exception candidata', () => {
    const { stream, emitted } = makeStream();
    stream.write(
      JSON.stringify({ level: 50, msg: 'boom', err: { message: 'fallo', stack: 's' } }),
    );
    const entry = emitted[0] as { error?: { message: string } };
    expect(entry.error?.message).toBe('fallo');
  });

  it('linea no-JSON (salida pretty) se descarta en silencio', () => {
    const { stream, emitted } = makeStream();
    expect(() => stream.write('[10:00:00] INFO: pretty output')).not.toThrow();
    expect(emitted).toEqual([]);
  });

  it('claves reservadas de pino no viajan como atributos; req si', () => {
    const { stream, emitted } = makeStream();
    stream.write(
      JSON.stringify({
        level: 30,
        msg: 'request',
        req: { method: 'GET', url: '/api/v1/health' },
        time: 1710000000,
        pid: 1,
        v: 1,
      }),
    );
    const entry = emitted[0] as { attributes: Record<string, unknown> };
    expect(entry.attributes['req']).toBeDefined();
    expect(entry.attributes['time']).toBeUndefined();
    expect(entry.attributes['pid']).toBeUndefined();
  });

  it('registro JSON sin msg no rompe', () => {
    const { stream, emitted } = makeStream();
    stream.write(JSON.stringify({ level: 30 }));
    expect((emitted[0] as { message: string }).message).toBe('');
  });
});
