import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { RateLimit } from '../../common/http/rate-limit';
import { parseWith } from '../../common/http/zod';
import { AuthService, Principal } from './auth.service';
import { AUTH_SERVICE, CurrentUser, SessionGuard } from './guards';

const linkRequest = z.object({ email: z.string().min(3).max(254) }).strict();
const sessionRequest = z
  .object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
  .strict();
const googleRequest = z
  .object({ idToken: z.string().min(10) })
  .strict();

const registerRequest = z
  .object({
    identifier: z.string().trim().min(3).max(254),
    password: z.string().min(6).max(100),
    name: z.string().trim().max(120).optional(),
  })
  .strict();

const loginRequest = z
  .object({
    identifier: z.string().trim().min(3).max(254),
    password: z.string().min(1).max(100),
  })
  .strict();

/** D4: access by a one-time email link, no password. */
@Controller('auth')
export class AuthController {
  constructor(@Inject(AUTH_SERVICE) private readonly auth: AuthService) {}

  /**
   * Queues a link. Always 202: new address or not, under the per-address cap
   * or over it. The cap is no lockout: the earlier links went to that inbox.
   */
  @Post('enlace')
  @HttpCode(202)
  @RateLimit('magicLink')
  async requestLink(@Body() body: unknown) {
    const { email } = parseWith(linkRequest, body);
    await this.auth.requestLink(email);
    return { enviado: true };
  }

  /** Exchanges the token of the link for a session, once. */
  @Post('sesion')
  @HttpCode(200)
  @RateLimit('magicLink')
  async openSession(@Body() body: unknown) {
    const { token } = parseWith(sessionRequest, body);
    const session = await this.auth.exchange(token);
    return {
      token_acceso: session.accessToken,
      vence_en: session.expiresAt.toISOString(),
      usuario: {
        usuario_id: session.user.id,
        email: session.user.email,
        rol: session.user.role,
      },
    };
  }

  /** Logs in or signs up via Google ID Token. */
  @Post('google')
  @HttpCode(200)
  async loginWithGoogle(@Body() body: unknown) {
    const { idToken } = parseWith(googleRequest, body);
    const session = await this.auth.loginWithGoogle(idToken);
    return {
      token_acceso: session.accessToken,
      vence_en: session.expiresAt.toISOString(),
      usuario: {
        usuario_id: session.user.id,
        email: session.user.email,
        rol: session.user.role,
      },
    };
  }

  /** Registers a buyer with DNI, phone or email + password. */
  @Post('registro')
  @HttpCode(200)
  async register(@Body() body: unknown) {
    const input = parseWith(registerRequest, body);
    const session = await this.auth.register(input);
    return {
      token_acceso: session.accessToken,
      vence_en: session.expiresAt.toISOString(),
      usuario: {
        usuario_id: session.user.id,
        email: session.user.email,
        documento: session.user.document,
        celular: session.user.phone,
        nombre: session.user.name,
        rol: session.user.role,
      },
    };
  }

  /** Logs in with DNI, phone or email + password. */
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown) {
    const { identifier, password } = parseWith(loginRequest, body);
    const session = await this.auth.login(identifier, password);
    return {
      token_acceso: session.accessToken,
      vence_en: session.expiresAt.toISOString(),
      usuario: {
        usuario_id: session.user.id,
        email: session.user.email,
        documento: session.user.document,
        celular: session.user.phone,
        nombre: session.user.name,
        rol: session.user.role,
      },
    };
  }

  @Post('salir')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async logout(@CurrentUser() principal: Principal): Promise<void> {
    await this.auth.logout(principal.sessionId);
  }

  @Get('yo')
  @UseGuards(SessionGuard)
  me(@CurrentUser() principal: Principal) {
    return {
      usuario_id: principal.id,
      email: principal.email,
      documento: principal.document,
      celular: principal.phone,
      nombre: principal.name,
      rol: principal.role,
    };
  }
}
