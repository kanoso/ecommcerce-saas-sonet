import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { z } from 'zod';
import { RateLimit } from '../../../../common/http/rate-limit';
import { parseWith, uuidParam } from '../../../../common/http/zod';
import type { Principal } from '../../../auth/auth.service';
import { CurrentUser, SessionGuard } from '../../../auth/guards';
import {
  ClaimLatePaymentUseCase,
  GetPaymentProofUseCase,
  ReserveTicketsUseCase,
  SubmitPaymentProofUseCase,
} from '../../application';
import { RaffleQueries } from '../../application/queries/raffle-queries';
import * as present from './presenters';
import { BankOrWallet } from '../../domain';
import { SystemClock } from '../jobs/system-clock';

/** A hard cap against huge uploads; ProofPolicy applies the configured size. */
export const UPLOAD_HARD_LIMIT_BYTES = 10 * 1024 * 1024;

/** Multer caps: one file, the five text fields, and short values. */
export const UPLOAD_LIMITS = {
  fileSize: UPLOAD_HARD_LIMIT_BYTES,
  files: 1,
  fields: 7,
  parts: 8,
  fieldSize: 1024,
  fieldNameSize: 50,
};

interface UploadedProof {
  buffer: Buffer;
}

const reservation = z
  .object({
    rifa_id: z.string().uuid(),
    numeros: z.array(z.number().int()).min(1).max(1000),
  })
  .strict();

const declaration = {
  numero_operacion: z.string().max(100).optional(),
  banco_o_billetera: z.nativeEnum(BankOrWallet),
  monto_declarado: z.coerce.number().positive().max(99_999_999.99),
};

/** The late claim: what the buyer declares, as before DT-19. */
const proofFields = z.object(declaration).strict();

/** The proof also names the operator account the buyer paid to (DT-19). */
const proofUploadFields = z
  .object({
    ...declaration,
    cuenta_id: z.string().uuid(),
    // The version of that account the buyer saw: multipart sends text.
    cuenta_version: z.coerce.number().int().positive(),
  })
  .strict();

/** Buyer routes: a session is required, and orders are the caller's own. */
@Controller()
@UseGuards(SessionGuard)
export class BuyerController {
  constructor(
    private readonly reserve: ReserveTicketsUseCase,
    private readonly submitProof: SubmitPaymentProofUseCase,
    private readonly claimLate: ClaimLatePaymentUseCase,
    private readonly proofs: GetPaymentProofUseCase,
    private readonly queries: RaffleQueries,
    private readonly clock: SystemClock,
  ) {}

  @Post('reservas')
  @HttpCode(201)
  @RateLimit('reservation')
  async createReservation(@CurrentUser() user: Principal, @Body() body: unknown) {
    const { rifa_id, numeros } = parseWith(reservation, body);
    const order = await this.reserve.execute({
      raffleId: rifa_id,
      userId: user.id,
      numbers: numeros,
    });
    return present.orderOf(order);
  }

  @Post('ordenes/:id/comprobante')
  @HttpCode(200)
  @RateLimit('proof')
  @UseInterceptors(FileInterceptor('archivo', { limits: UPLOAD_LIMITS }))
  async proof(
    @CurrentUser() user: Principal,
    @Param('id') id: string,
    @Body() body: unknown,
    @UploadedFile() file: UploadedProof | undefined,
  ) {
    const fields = parseWith(proofUploadFields, body);
    const order = await this.submitProof.execute({
      orderId: parseWith(uuidParam, id),
      userId: user.id,
      file: file ? new Uint8Array(file.buffer) : null,
      operationNumber: fields.numero_operacion ?? null,
      bankOrWallet: fields.banco_o_billetera,
      declaredAmount: fields.monto_declarado,
      paymentAccountId: fields.cuenta_id,
      paymentAccountVersion: fields.cuenta_version,
    });
    return present.orderWithServerTime(RaffleQueries.orderView(order), this.clock.now());
  }

  @Post('ordenes/:id/pago-tardio')
  @HttpCode(202)
  @RateLimit('proof')
  @UseInterceptors(FileInterceptor('archivo', { limits: UPLOAD_LIMITS }))
  async latePayment(
    @CurrentUser() user: Principal,
    @Param('id') id: string,
    @Body() body: unknown,
    @UploadedFile() file: UploadedProof | undefined,
  ) {
    const fields = parseWith(proofFields, body);
    const orderId = parseWith(uuidParam, id);
    await this.claimLate.execute({
      orderId,
      userId: user.id,
      file: file ? new Uint8Array(file.buffer) : null,
      operationNumber: fields.numero_operacion ?? null,
      bankOrWallet: fields.banco_o_billetera,
      declaredAmount: fields.monto_declarado,
    });
    return present.orderWithServerTime(await this.queries.orderFor(orderId, user.id), this.clock.now());
  }

  /** With hora_servidor: the web counts the reservation down from it. */
  @Get('ordenes/:id')
  async order(@CurrentUser() user: Principal, @Param('id') id: string) {
    const order = await this.queries.orderFor(parseWith(uuidParam, id), user.id);
    return present.orderWithServerTime(order, this.clock.now());
  }

  /** The owner or an operator. Never cached, never from a public path. */
  @Get('ordenes/:id/comprobante')
  async downloadProof(
    @CurrentUser() user: Principal,
    @Param('id') id: string,
    @Res() response: Response,
  ): Promise<void> {
    const proof = await this.proofs.execute({
      orderId: parseWith(uuidParam, id),
      userId: user.id,
      isAdmin: user.role === 'admin',
    });
    response
      .status(200)
      .setHeader('Content-Type', proof.contentType)
      .setHeader('Cache-Control', 'private, no-store')
      .setHeader('Content-Disposition', 'inline; filename="comprobante"')
      .setHeader('X-Content-Type-Options', 'nosniff')
      .send(Buffer.from(proof.content));
  }

  @Get('mis-boletos')
  async myTickets(@CurrentUser() user: Principal) {
    return (await this.queries.ticketsOf(user.id)).map(present.myTicket);
  }
}
