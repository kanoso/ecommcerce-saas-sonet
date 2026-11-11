import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PersistenceModule } from '../raffles/infrastructure/persistence';
import { SystemClock } from '../raffles/infrastructure/jobs/system-clock';
import { Env, env } from '../raffles/infrastructure/wiring';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminGuard, AUTH_SERVICE, SessionGuard } from './guards';
import { PrismaAuthStore } from './prisma-auth.store';

/** D4: buyers' and operators' own accounts, with an email magic link. */
@Module({
  imports: [
    PersistenceModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: Env) => ({
        // validateEnv guarantees a secret; only tests get a built-in one.
        secret: env(config, 'JWT_SECRET') as string,
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    PrismaAuthStore,
    {
      provide: AUTH_SERVICE,
      inject: [PrismaAuthStore, JwtService, ConfigService],
      useFactory: (store: PrismaAuthStore, jwt: JwtService, config: Env) =>
        new AuthService(store, jwt, new SystemClock(), {
          linkTtlMinutes: env(config, 'MAGIC_LINK_TTL_MINUTES'),
          maxLinksPerWindow: env(config, 'MAGIC_LINK_MAX_PER_WINDOW'),
          sessionTtlHours: env(config, 'SESSION_TTL_HOURS'),
          linkBaseUrl: env(config, 'MAGIC_LINK_BASE_URL'),
          googleClientId: env(config, 'GOOGLE_CLIENT_ID'),
        }),
    },
    SessionGuard,
    AdminGuard,
  ],
  exports: [AUTH_SERVICE, SessionGuard, AdminGuard, PrismaAuthStore],
})
export class AuthModule {}
