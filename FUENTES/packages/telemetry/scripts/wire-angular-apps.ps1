param()
$ErrorActionPreference = 'Stop'
$apps = @(
  @{ dir='FUENTES\tiendi-vendor'; service='tiendi-vendor'; versionExpr="environment.appVersion ?? 'unknown'" },
  @{ dir='FUENTES\tiendi-admin'; service='tiendi-admin'; versionExpr="environment.appVersion ?? 'unknown'" },
  @{ dir='FUENTES\tiendi-kipu\web'; service='tiendi-kipu-web'; versionExpr="buildInfo.commit" }
)

foreach ($app in $apps) {
  $dir = $app.dir
  $service = $app.service
  New-Item -ItemType Directory -Force -Path "$dir\src\app" | Out-Null

  # telemetry.browser.ts
  $versionExpr = $app.versionExpr
  $tb = @"
import { createClientTelemetry, type BrowserTelemetry } from '@kanoso/telemetry/browser';
import { environment } from '../environments/environment';

/**
 * Singleton de telemetria browser (guia T5). Flags de BUILD — un cambio
 * requiere rebuild/distribucion; nunca querystring/localStorage/headers.
 */
let instance: BrowserTelemetry | null = null;

export function initClientTelemetry(): BrowserTelemetry | null {
  if (instance) return instance;
  instance = createClientTelemetry({
    serviceName: '$service',
    serviceVersion: $versionExpr,
    deploymentEnvironment: environment.production ? 'test' : 'development',
    telemetryEnv: environment.telemetry as unknown as Record<string, string | undefined>,
    gatewayUrl: environment.telemetryGatewayUrl,
  });
  return instance;
}

/** Null cuando la canalizacion esta apagada: interceptores no-op. */
export function getClientTelemetry(): BrowserTelemetry | null {
  return instance;
}
"@
  Set-Content "$dir\src\app\telemetry.browser.ts" $tb

  # interceptor
  $it = @"
import { HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs';
import { httpPropagation } from '@kanoso/telemetry/browser';
import { environment } from '../environments/environment';
import { getClientTelemetry } from './telemetry.browser';

/**
 * Propagacion W3C (guia T5): span por request + traceparent SOLO a la
 * allowlist exacta de APIs propias. NUNCA a terceros (pagos, mapas,
 * analytics). Sin telemetria activa es no-op total.
 */
export const otelPropagationInterceptor: HttpInterceptorFn = (req, next) => {
  const telemetry = getClientTelemetry();
  const result = telemetry
    ? httpPropagation(
        telemetry,
        req,
        environment.telemetryAllowedOrigins ?? [],
        window.location.origin,
      )
    : null;
  if (!result) return next(req);
  return next(req.clone({ setHeaders: result.headers })).pipe(
    finalize(() => result.endSpan()),
  );
};
"@
  Set-Content "$dir\src\app\otel-propagation.interceptor.ts" $it

  Write-Host "OK $service"
}
