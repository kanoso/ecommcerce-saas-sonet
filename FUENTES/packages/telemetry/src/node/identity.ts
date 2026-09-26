/**
 * Identidad de recurso OTel (guia §4): service.name/namespace/version,
 * deployment.environment.name e instance.id por RUNTIME, no por request.
 * La version del package (0.0.x) no basta: revision Git/build ID.
 */
import os from 'node:os';
import type { TelemetryEnv } from '../contract';

export interface TelemetryIdentity {
  serviceName: string;
  /** Revision Git o build ID; vacio dispara aviso (resource incompleto). */
  serviceVersion: string;
  /** deployment.environment.name — INDEPENDIENTE de NODE_ENV. */
  deploymentEnvironment: string;
  instanceId: string;
}

export interface IdentityWarnings {
  identity: TelemetryIdentity;
  warnings: string[];
}

/**
 * Resuelve identidad desde el entorno del despliegue. Orden:
 * TIENDI_SERVICE_VERSION > BUILD_SHA > GIT_SHA. deployment.environment.name
 * SOLO de TIENDI_DEPLOYMENT_ENV — nunca se deduce de NODE_ENV.
 */
export function identityFromEnv(
  env: TelemetryEnv,
  fallbackServiceName: string,
): IdentityWarnings {
  const warnings: string[] = [];

  const serviceName = env['TIENDI_SERVICE_NAME'] ?? fallbackServiceName;
  if (!env['TIENDI_SERVICE_NAME']) {
    warnings.push(`TIENDI_SERVICE_NAME sin definir, usando fallback "${fallbackServiceName}"`);
  }

  const serviceVersion =
    env['TIENDI_SERVICE_VERSION'] ?? env['BUILD_SHA'] ?? env['GIT_SHA'] ?? '';
  if (!serviceVersion) {
    warnings.push('service.version sin revision Git/build ID: defina TIENDI_SERVICE_VERSION o BUILD_SHA');
  }

  const deploymentEnvironment = env['TIENDI_DEPLOYMENT_ENV'] ?? '';
  if (!deploymentEnvironment) {
    warnings.push('deployment.environment.name sin definir: defina TIENDI_DEPLOYMENT_ENV (independiente de NODE_ENV)');
  }

  const instanceId =
    env['TIENDI_SERVICE_INSTANCE'] ?? `${os.hostname()}:${process.pid}`;

  return {
    identity: { serviceName, serviceVersion, deploymentEnvironment, instanceId },
    warnings,
  };
}
