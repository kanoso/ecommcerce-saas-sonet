import { LogPipeline, buildAttributes } from '../src/pipeline';
import { SEVERITY_BY_LEVEL, levelAtOrAbove } from '../src/severity';

const CANARY = 'usuario@test.com';

describe('pipeline (choke point unico)', () => {
  it('respeta el umbral configurado', () => {
    const emitted: unknown[] = [];
    const pipeline = new LogPipeline('WARN', (record) => emitted.push(record));
    pipeline.emit({ level: 'INFO', message: 'no pasa' });
    pipeline.emit({ level: 'WARN', message: 'pasa' });
    pipeline.emit({ level: 'ERROR', message: 'pasa' });
    expect(emitted.length).toBe(2);
  });

  it('sink null (export apagado): no produce nada, no lanza', () => {
    const pipeline = new LogPipeline('INFO', null);
    expect(() =>
      pipeline.emit({ level: 'ERROR', message: 'sin canal' }),
    ).not.toThrow();
  });

  it('aplica redaccion SIEMPRE, incluso con sink local', () => {
    const emitted: Array<{ fields: { message: string } }> = [];
    const pipeline = new LogPipeline('INFO', (record) => emitted.push(record as never));
    pipeline.emit({ level: 'ERROR', message: `fallo ${CANARY}` });
    expect(emitted[0]!.fields.message).not.toContain(CANARY);
  });

  it('construye event.name y exception.* solo cuando aplican', () => {
    const attrs = buildAttributes({
      eventName: 'http.request.failed',
      attributes: { 'http.route': '/api/v1/orders' },
      exception: { type: 'Error', message: 'boom', stacktrace: 'Error: boom\n    at x' },
    });
    expect(attrs['event.name']).toBe('http.request.failed');
    expect(attrs['exception.type']).toBe('Error');
    expect(attrs['exception.stacktrace']).toContain('at x');
    const empty = buildAttributes({});
    expect(empty['event.name']).toBeUndefined();
  });

  it('severidad OTel normalizada', () => {
    expect(SEVERITY_BY_LEVEL.ERROR.text).toBe('ERROR');
    expect(SEVERITY_BY_LEVEL.ERROR.number).toBeGreaterThan(SEVERITY_BY_LEVEL.INFO.number);
    expect(levelAtOrAbove('ERROR', 'WARN')).toBe(true);
    expect(levelAtOrAbove('DEBUG', 'WARN')).toBe(false);
  });
});
