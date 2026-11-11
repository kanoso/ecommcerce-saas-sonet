import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Express } from 'express';
import helmet from 'helmet';
import { parseTrustProxy } from './common/http/client-ip';

/** Shared by main.ts and the e2e tests, so both serve the same API. */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const prefix = config.get<string>('API_PREFIX', 'api');

  // req.ip, and so every rate limit, trusts X-Forwarded-For only from the
  // proxies TRUST_PROXY names (behind Cloudflare: its published ranges).
  (app.getHttpAdapter().getInstance() as Express).set(
    'trust proxy',
    parseTrustProxy(config.get<string>('TRUST_PROXY', 'loopback')),
  );
  app.use(helmet());
  app.enableCors({
    origin: config
      .get<string>('CORS_ORIGINS', '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  });
  app.setGlobalPrefix(prefix, { exclude: ['health', 'health/ready'] });

  // As in tiendi-api: the documentation is served outside production only.
  if (config.get<string>('NODE_ENV') !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Tiendi Rifas API')
        .setDescription('Rifas verificables: reservas, pagos manuales, sorteo y verificación (spec §11).')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup(`${prefix}/docs`, app, document);
  }
}
