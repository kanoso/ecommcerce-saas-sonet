import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // SIGTERM closes the BullMQ worker and queues: a job in progress finishes
  // or is handed back instead of being cut in half.
  app.enableShutdownHooks();
  configureApp(app);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);
  console.log(`tiendi-rifas-api running on port ${port}`);
}

void bootstrap();
