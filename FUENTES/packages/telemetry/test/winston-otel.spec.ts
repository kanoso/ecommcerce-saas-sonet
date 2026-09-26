import { OtelWinstonTransport, type WinstonLogInfo } from '../src/node/winston-otel';

describe('bridge Winston -> OTel (T1)', () => {
  const makeTransport = () => {
    const emitted: unknown[] = [];
    const transport = new OtelWinstonTransport({
      emitLog: (entry) => emitted.push(entry),
    });
    return { transport, emitted };
  };

  it('mapea niveles winston a severidad del contrato', () => {
    const { transport, emitted } = makeTransport();
    (['error', 'warn', 'info', 'debug'] as const).forEach((level, i) => {
      transport.log({ level, message: `m${i}` }, () => undefined);
    });
    expect(emitted.map((e) => (e as { level: string }).level)).toEqual([
      'ERROR',
      'WARN',
      'INFO',
      'DEBUG',
    ]);
  });

  it('nivel desconocido cae a INFO sin romper', () => {
    const { transport, emitted } = makeTransport();
    transport.log({ level: 'custom', message: 'x' }, () => undefined);
    expect((emitted[0] as { level: string }).level).toBe('INFO');
  });

  it('nest-winston context pasa como log.logger; metadata viaja a atributos', () => {
    const { transport, emitted } = makeTransport();
    const info: WinstonLogInfo = {
      level: 'error',
      message: 'pedido fallo',
      context: 'OrdersService',
      orderId: 'ord-1',
    };
    transport.log(info, () => undefined);
    const entry = emitted[0] as {
      attributes: Record<string, unknown>;
      eventName: string;
    };
    expect(entry.attributes['log.logger']).toBe('OrdersService');
    expect(entry.attributes['context']).toBeUndefined();
    expect(entry.attributes['orderId']).toBe('ord-1');
    expect(entry.eventName).toBe('log.record');
  });

  it('callback siempre se invoca (pipeline winston no queda colgado)', () => {
    const { transport } = makeTransport();
    let done = false;
    transport.log({ level: 'info', message: 'x' }, () => {
      done = true;
    });
    expect(done).toBe(true);
  });

  it('la redaccion NO ocurre en el transport: ocurre en telemetry.emit (choke point)', () => {
    const { transport, emitted } = makeTransport();
    transport.log(
      { level: 'info', message: 'x', password: 'sin-scrub-aqui' },
      () => undefined,
    );
    expect((emitted[0] as { attributes: Record<string, unknown> }).attributes['password']).toBe(
      'sin-scrub-aqui',
    );
  });
});
