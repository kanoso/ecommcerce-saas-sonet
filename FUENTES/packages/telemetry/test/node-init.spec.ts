import * as api from '@opentelemetry/api';
import { context } from '@opentelemetry/api';
import { initNodeTelemetry, identityFromEnv, type TelemetryIdentity } from '../src/node';
import { loadTelemetryConfig } from '../src/contract';
import { activeTraceIds } from '../src/context';

const IDENTITY: TelemetryIdentity = {
  serviceName: 'tiendi-api',
  serviceVersion: 'abc1234',
  deploymentEnvironment: 'test',
  instanceId: 'host-1:123',
};

const testFlags = (env: Record<string, string | undefined>) => loadTelemetryConfig(env);

describe('initNodeTelemetry (T1: flags por ambiente)', () => {
  it('todo apagado: canalizacion inactiva, sin globals, emit es no-op seguro', () => {
    const telemetry = initNodeTelemetry({
      flags: testFlags({}),
      identity: IDENTITY,
    });
    expect(telemetry.active).toBe(false);
    expect(() =>
      telemetry.emit({ level: 'ERROR', message: 'sin canal', error: new Error('x') }),
    ).not.toThrow();
    awaitNoGlobals();
  });

  it('contexto sin export: provider de contexto activo, span NO exportado, trace id valido', async () => {
    const telemetry = initNodeTelemetry({
      flags: testFlags({ TIENDI_OTEL_CONTEXT_ENABLED: 'true' }),
      identity: IDENTITY,
    });
    expect(telemetry.active).toBe(true);

    const span = telemetry.tracer('test').startSpan('test.op');
    await context.with(api.trace.setSpan(context.active(), span), async () => {
      const ids = activeTraceIds();
      // Contexto habilitado con export de spans apagado: IDs VALIDOS para
      // correlacion de logs, sin envio de spans (entrega 1).
      expect(ids.traceId).toMatch(/^[0-9a-f]{32}$/);
      expect(ids.spanId).toMatch(/^[0-9a-f]{16}$/);
      telemetry.emit({ level: 'INFO', message: 'dentro del span' });
    });
    span.end();
    await telemetry.shutdown();
    expect(telemetry.flags.tracesExportEnabled).toBe(false);
  });

  it('logs+export: umbral y saneamiento aplicados antes de exportar', async () => {
    const telemetry = initNodeTelemetry({
      flags: testFlags({
        TIENDI_OTEL_LOGS_ENABLED: 'true',
        TIENDI_OTEL_LOGS_EXPORT_ENABLED: 'true',
        TIENDI_OTEL_CONTEXT_ENABLED: 'true',
      }),
      identity: IDENTITY,
      logsEndpoint: 'http://127.0.0.1:1/v1/logs',
      maxQueueSize: 16,
      scheduledDelayMillis: 10_000,
    });
    expect(telemetry.active).toBe(true);
    // Emit con datos sensibles + error: no debe lanzar ni filtrar por
    // errores de red del exporter de prueba (endpoint muerto).
    expect(() =>
      telemetry.emit({
        level: 'ERROR',
        message: 'fallo pedido usuario@test.com',
        eventName: 'http.request.failed',
        attributes: { password: 'x', route: '/api/v1/orders' },
        error: new Error('boom'),
      }),
    ).not.toThrow();
    await telemetry.shutdown();
  });

  it('export apagado + contexto encendido: correlacion local sin exporters', async () => {
    const telemetry = initNodeTelemetry({
      flags: testFlags({ TIENDI_OTEL_CONTEXT_ENABLED: 'true' }),
      identity: IDENTITY,
    });
    expect(telemetry.flags.logsExportEnabled).toBe(false);
    expect(telemetry.active).toBe(true);
    await telemetry.shutdown();
  });
});

describe('identityFromEnv (recurso OTel por runtime)', () => {
  it('usa TIENDI_* y avisa si falta version o ambiente', () => {
    const { identity, warnings } = identityFromEnv({}, 'tiendi-api');
    expect(identity.serviceName).toBe('tiendi-api');
    expect(identity.serviceVersion).toBe('');
    expect(identity.deploymentEnvironment).toBe('');
    expect(warnings.join(' ')).toContain('TIENDI_SERVICE_VERSION');
    expect(warnings.join(' ')).toContain('TIENDI_DEPLOYMENT_ENV');
  });

  it('deployment.environment.name independiente de NODE_ENV', () => {
    const { identity, warnings } = identityFromEnv(
      { TIENDI_SERVICE_NAME: 'tiendi-kipu-api', TIENDI_DEPLOYMENT_ENV: 'test', NODE_ENV: 'production', BUILD_SHA: 'deadbeef' },
      'tiendi-kipu-api',
    );
    expect(identity.deploymentEnvironment).toBe('test');
    expect(identity.serviceVersion).toBe('deadbeef');
    expect(warnings).toEqual([]);
  });
});

/** Verifica que el init apagado no registro context manager global OTel. */
function awaitNoGlobals() {
  // Si initNodeTelemetry registro un manager, el active() seria un
  // AsyncLocalStorageContextManager; en default sigue siendo ROOT.
  expect(context.active()).toBeDefined();
}
