import {
  loadTelemetryConfig,
  parseStrictBoolean,
  parseLogLevel,
  isTelemetryActive,
} from '../src/contract';

const FLAG_KEYS = [
  'TIENDI_OTEL_LOGS_ENABLED',
  'TIENDI_OTEL_LOGS_EXPORT_ENABLED',
  'TIENDI_OTEL_CONTEXT_ENABLED',
  'TIENDI_OTEL_TRACES_EXPORT_ENABLED',
  'TIENDI_OTEL_LOG_LEVEL',
];

const allOff = () => Object.fromEntries(FLAG_KEYS.map((k) => [k, undefined]));

describe('contrato TIENDI_OTEL_* (guia §4)', () => {
  it('defaults seguros: todo apagado, WARN, sin avisos', () => {
    const flags = loadTelemetryConfig(allOff());
    expect(flags).toMatchObject({
      logsEnabled: false,
      logsExportEnabled: false,
      contextEnabled: false,
      tracesExportEnabled: false,
      logLevel: 'WARN',
    });
    expect(flags.warnings).toEqual([]);
    expect(isTelemetryActive(flags)).toBe(false);
  });

  it('piloto TEST explicito: logs+export+contexto en true, INFO', () => {
    const flags = loadTelemetryConfig({
      TIENDI_OTEL_LOGS_ENABLED: 'true',
      TIENDI_OTEL_LOGS_EXPORT_ENABLED: 'true',
      TIENDI_OTEL_CONTEXT_ENABLED: 'true',
      TIENDI_OTEL_LOG_LEVEL: 'INFO',
    });
    expect(flags.logsEnabled).toBe(true);
    expect(flags.logsExportEnabled).toBe(true);
    expect(flags.contextEnabled).toBe(true);
    expect(flags.logLevel).toBe('INFO');
    expect(flags.warnings).toEqual([]);
  });

  it.each(['1', '0', 'yes', 'enabled', ''])('booleano invalido %j deshabilita y avisa', (raw) => {
    const flags = loadTelemetryConfig({ TIENDI_OTEL_LOGS_ENABLED: raw });
    expect(flags.logsEnabled).toBe(false);
    expect(flags.warnings.join(' ')).toContain('TIENDI_OTEL_LOGS_ENABLED');
    expect(isTelemetryActive(flags)).toBe(false);
  });

  it('export sin logs queda dominado por LOGS_ENABLED=false', () => {
    const flags = loadTelemetryConfig({
      TIENDI_OTEL_LOGS_ENABLED: 'false',
      TIENDI_OTEL_LOGS_EXPORT_ENABLED: 'true',
    });
    expect(flags.logsExportEnabled).toBe(false);
    expect(flags.warnings.join(' ')).toContain('requiere TIENDI_OTEL_LOGS_ENABLED');
  });

  it('export de spans forzado a false en la entrega 1', () => {
    const flags = loadTelemetryConfig({ TIENDI_OTEL_TRACES_EXPORT_ENABLED: 'true' });
    expect(flags.tracesExportEnabled).toBe(false);
    expect(flags.warnings.join(' ')).toContain('entrega 2');
  });

  it('booleano con espacios/caso se normaliza (trim + lowercase)', () => {
    const flags = loadTelemetryConfig({ TIENDI_OTEL_LOGS_ENABLED: 'TRUE ' });
    expect(flags.logsEnabled).toBe(true);
  });

  it('nivel invalido cae a WARN con aviso', () => {
    const flags = loadTelemetryConfig({ TIENDI_OTEL_LOG_LEVEL: 'VERBOSE' });
    expect(flags.logLevel).toBe('WARN');
    expect(flags.warnings.join(' ')).toContain('TIENDI_OTEL_LOG_LEVEL');
  });

  it('logs sin contexto avisan (no rompen)', () => {
    const flags = loadTelemetryConfig({ TIENDI_OTEL_LOGS_ENABLED: 'true' });
    expect(flags.logsEnabled).toBe(true);
    expect(flags.warnings.join(' ')).toContain('trace_id');
  });

  it('override explicito del despliegue gana al entorno', () => {
    const flags = loadTelemetryConfig(
      { TIENDI_OTEL_LOGS_ENABLED: 'true', TIENDI_OTEL_CONTEXT_ENABLED: 'true' },
      { logsEnabled: false },
    );
    expect(flags.logsEnabled).toBe(false);
    expect(flags.contextEnabled).toBe(true);
  });

  it('NODE_ENV nunca activa telemetria', () => {
    const flags = loadTelemetryConfig({ ...allOff(), NODE_ENV: 'production' });
    expect(isTelemetryActive(flags)).toBe(false);
  });

  it('parseStrictBoolean / parseLogLevel casos limite', () => {
    expect(parseStrictBoolean('true')).toBe(true);
    expect(parseStrictBoolean('False')).toBe(false);
    expect(parseStrictBoolean(undefined)).toBeNull();
    expect(parseStrictBoolean('tru')).toBeNull();
    expect(parseLogLevel('debug')).toBe('DEBUG');
    expect(parseLogLevel('ERROR ')).toBe('ERROR');
    expect(parseLogLevel(undefined)).toBeNull();
  });
});
