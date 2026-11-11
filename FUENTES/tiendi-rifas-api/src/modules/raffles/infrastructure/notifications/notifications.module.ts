import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Notifier } from '../../application/ports';
import { PersistenceModule, PrismaService } from '../persistence';
import { Env, env } from '../wiring';
import { LoggingNotifier } from './logging-notifier';
import { TiendiNotificationsClient } from './tiendi-notifications.client';
import {
  RecipientDirectory,
  TiendiNotificationsNotifier,
} from './tiendi-notifications-notifier';

export const NOTIFIER = Symbol('NOTIFIER');
/** True when emails really leave: only then may the dispatcher mark them sent. */
export const EMAIL_DELIVERY_REAL = Symbol('EMAIL_DELIVERY_REAL');

class PrismaRecipientDirectory implements RecipientDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async emailOf(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email ?? null;
  }
}

/**
 * The access page lives on the public web, so its origin is the web's:
 * one setting, already checked for production, serves both links.
 */
function webOrigin(magicLinkBaseUrl: string): string {
  return new URL(magicLinkBaseUrl).origin;
}

/**
 * D5: emails go through tiendi-notifications. Without it, env validation lets
 * the app start only under tests, or in development with EMAIL_LOG_ONLY=true;
 * then the logging notifier stands in and sends nothing.
 */
function notifierFrom(config: Env, prisma: PrismaService): Notifier {
  const baseUrl = env(config, 'NOTIFICATIONS_URL');
  const serviceToken = env(config, 'NOTIFICATIONS_SERVICE_TOKEN');
  if (baseUrl && serviceToken) {
    return new TiendiNotificationsNotifier(
      new TiendiNotificationsClient({
        baseUrl,
        serviceToken,
        timeoutMs: env(config, 'NOTIFICATIONS_TIMEOUT_MS'),
      }),
      new PrismaRecipientDirectory(prisma),
      env(config, 'OPERATOR_ALERT_EMAILS')
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean),
      webOrigin(env(config, 'MAGIC_LINK_BASE_URL')),
    );
  }
  return new LoggingNotifier(new Logger('LoggingNotifier'), {
    logLinks: env(config, 'EMAIL_LOG_ONLY'),
  });
}

@Module({
  imports: [PersistenceModule],
  providers: [
    { provide: NOTIFIER, inject: [ConfigService, PrismaService], useFactory: notifierFrom },
    {
      provide: EMAIL_DELIVERY_REAL,
      inject: [NOTIFIER],
      useFactory: (notifier: Notifier) => notifier instanceof TiendiNotificationsNotifier,
    },
  ],
  exports: [NOTIFIER, EMAIL_DELIVERY_REAL],
})
export class NotificationsModule {}
