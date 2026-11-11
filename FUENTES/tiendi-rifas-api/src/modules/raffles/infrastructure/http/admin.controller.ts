import { randomUUID } from 'crypto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { parseWith, uuidParam } from '../../../../common/http/zod';
import type { Principal } from '../../../auth/auth.service';
import {
  AdminGuard,
  CurrentUser,
  operatorIdOf,
  SessionGuard,
} from '../../../auth/guards';
import {
  ApprovePaymentUseCase,
  CompleteRefundUseCase,
  ConfirmLatePaymentUseCase,
  CreateRaffleUseCase,
  UpdateDraftRaffleUseCase,
  DeleteDraftRaffleUseCase,
  DismissLatePaymentUseCase,
  ExecuteDrawUseCase,
  ListLatePaymentClaimsUseCase,
  ListOperationCollisionsUseCase,
  ListPaymentAccountsUseCase,
  ListPendingPaymentAccountChangesUseCase,
  PaymentAccountOutcome,
  ProposePaymentAccountUseCase,
  ApprovePaymentAccountChangeUseCase,
  RejectPaymentAccountChangeUseCase,
  CancelPaymentAccountChangeUseCase,
  ListPendingRefundsUseCase,
  ListUnreadOperatorAlertsUseCase,
  MarkOperatorAlertReadUseCase,
  PublishRaffleUseCase,
  RecordExtraTransferUseCase,
  RejectPaymentUseCase,
  RequeueFailedNotificationUseCase,
  SellInPersonUseCase,
  SetPaymentAccountActiveUseCase,
  UpdatePaymentAccountUseCase,
} from '../../application';
import { RaffleQueries } from '../../application/queries/raffle-queries';
import { CancelAlteredRaffleUseCase } from '../../application/use-cases/cancel-altered-raffle.use-case';
import { BankOrWallet, DrawEffect, DrawMode, DrawSpeed, MAX_DISPLAY_ORDER } from '../../domain';
import * as present from './presenters';

const reason = z.string().trim().min(1).max(500);
const amount = z.number().positive().max(99_999_999.99);
const operationNumber = z.string().min(1).max(100);
const bank = z.nativeEnum(BankOrWallet);
const collision = z
  .object({ motivo: reason, banco: bank })
  .strict()
  .nullish();
const overpayment = z
  .object({ confirmado: z.literal(true), motivo: reason })
  .strict()
  .nullish();

const money = {
  monto_recibido: amount,
  banco_o_billetera: bank,
  numero_operacion: operationNumber,
  colision: collision,
  sobrepago: overpayment,
};

const createRaffle = z
  .object({
    titulo: z.string().trim().min(1).max(200),
    premio: z.string().trim().min(1).max(500),
    precio_boleto: amount,
    numero_min: z.number().int().min(0),
    numero_max: z.number().int().min(0),
    intento_ganador: z.number().int().min(1).max(5).default(1),
    efecto_sorteo: z.nativeEnum(DrawEffect).default(DrawEffect.SLOT_MACHINE),
    modalidad_sorteo: z.nativeEnum(DrawMode).default(DrawMode.AUTOMATIC),
    duracion_efecto_seg: z.number().int().min(1).max(60).default(4),
    velocidad_efecto: z.nativeEnum(DrawSpeed).default(DrawSpeed.NORMAL),
    descripcion_premio: z.string().trim().max(10000).nullish(),
    imagenes_premio: z.array(z.string().url()).max(10).default([]),
  })
  .strict();
const updateDraftRaffle = z
  .object({
    titulo: z.string().trim().min(1).max(200).optional(),
    premio: z.string().trim().min(1).max(500).optional(),
    precio_boleto: amount.optional(),
    intento_ganador: z.number().int().min(1).max(5).optional(),
    efecto_sorteo: z.nativeEnum(DrawEffect).optional(),
    modalidad_sorteo: z.nativeEnum(DrawMode).optional(),
    duracion_efecto_seg: z.number().int().min(1).max(60).optional(),
    velocidad_efecto: z.nativeEnum(DrawSpeed).optional(),
    descripcion_premio: z.string().trim().max(10000).nullish(),
    imagenes_premio: z.array(z.string().url()).max(10).optional(),
  })
  .strict();
const publishRaffle = z
  .object({
    resolucion_autorizacion: z.string().trim().min(1).max(200),
    cierre_ventas: z.string().datetime(),
    fecha_sorteo: z.string().datetime(),
  })
  .strict();
const approve = z
  .object({ numero_operacion: operationNumber, monto_recibido: amount, colision: collision })
  .strict();
const reject = z.discriminatedUnion('dinero_recibido', [
  z.object({ dinero_recibido: z.literal(false), motivo: reason }).strict(),
  z.object({ dinero_recibido: z.literal(true), motivo: reason, ...money }).strict(),
]);
const confirmLate = z.object(money).strict();
const dismiss = z.object({ motivo: reason }).strict();
const extraTransfer = z.object({ ...money, motivo: reason }).strict();
const completeRefund = z
  .object({ destino: z.string().trim().min(1).max(200), numero_operacion: operationNumber })
  .strict();
const cancelAltered = z.object({ motivo: reason }).strict();
const inPersonSale = z
  .object({
    numeros: z.array(z.number().int()).min(1),
    alias: z.string().trim().min(1).max(100),
    telefono: z.string().trim().min(1).max(50),
    documento: z.string().trim().min(1).max(50).optional().nullable(),
  })
  .strict();

// Formats are checked by the PaymentAccount model (DT-19); these only bound sizes.
const accountFields = {
  metodo: bank,
  titular: z.string().max(200),
  numero: z.string().max(40),
  cci: z.string().max(40).nullable(),
  // The same bounds as the PaymentAccount model.
  orden: z.number().int().min(0).max(MAX_DISPLAY_ORDER),
};
const createAccount = z
  .object({ ...accountFields, cci: accountFields.cci.optional(), orden: accountFields.orden.optional() })
  .strict();
const updateAccount = z
  .object(accountFields)
  .partial()
  .strict()
  .refine((fields) => Object.keys(fields).length > 0, { message: 'Nothing to change' });

type AccountBody = z.infer<typeof updateAccount>;

/** The request's Spanish keys to the model's fields, only those given. */
function accountChanges(body: AccountBody) {
  return {
    ...(body.metodo !== undefined && { method: body.metodo }),
    ...(body.titular !== undefined && { holderName: body.titular }),
    ...(body.numero !== undefined && { accountNumber: body.numero }),
    ...(body.cci !== undefined && { cci: body.cci }),
    ...(body.orden !== undefined && { displayOrder: body.orden }),
  };
}

type MoneyFields = {
  monto_recibido: number;
  banco_o_billetera: BankOrWallet;
  numero_operacion: string;
  colision?: { motivo: string; banco: BankOrWallet } | null;
  sobrepago?: { confirmado: true; motivo: string } | null;
};

function receivedMoney(fields: MoneyFields) {
  return {
    receivedAmount: fields.monto_recibido,
    bankOrWallet: fields.banco_o_billetera,
    operationNumber: fields.numero_operacion,
    collision: fields.colision
      ? { reason: fields.colision.motivo, bank: fields.colision.banco }
      : null,
    overpayment: fields.sobrepago
      ? { confirmed: true as const, reason: fields.sobrepago.motivo }
      : null,
  };
}

/**
 * Operator routes. The operator id always comes from the session (DT-17):
 * no body field can name another operator.
 */
@Controller('admin')
@UseGuards(SessionGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly queries: RaffleQueries,
    private readonly createRaffleUseCase: CreateRaffleUseCase,
    private readonly updateDraftRaffleUseCase: UpdateDraftRaffleUseCase,
    private readonly publishRaffleUseCase: PublishRaffleUseCase,
    private readonly executeDraw: ExecuteDrawUseCase,
    private readonly cancelAlteredUseCase: CancelAlteredRaffleUseCase,
    private readonly approvePayment: ApprovePaymentUseCase,
    private readonly rejectPayment: RejectPaymentUseCase,
    private readonly confirmLatePayment: ConfirmLatePaymentUseCase,
    private readonly dismissLatePayment: DismissLatePaymentUseCase,
    private readonly recordExtraTransfer: RecordExtraTransferUseCase,
    private readonly completeRefundUseCase: CompleteRefundUseCase,
    private readonly listLateClaims: ListLatePaymentClaimsUseCase,
    private readonly listCollisions: ListOperationCollisionsUseCase,
    private readonly listAlerts: ListUnreadOperatorAlertsUseCase,
    private readonly markAlertRead: MarkOperatorAlertReadUseCase,
    private readonly requeueNotification: RequeueFailedNotificationUseCase,
    private readonly listPendingRefunds: ListPendingRefundsUseCase,
    private readonly listAccounts: ListPaymentAccountsUseCase,
    private readonly listAccountChanges: ListPendingPaymentAccountChangesUseCase,
    private readonly proposeAccountUseCase: ProposePaymentAccountUseCase,
    private readonly updateAccountUseCase: UpdatePaymentAccountUseCase,
    private readonly setAccountActive: SetPaymentAccountActiveUseCase,
    private readonly approveAccountChange: ApprovePaymentAccountChangeUseCase,
    private readonly rejectAccountChange: RejectPaymentAccountChangeUseCase,
    private readonly cancelAccountChange: CancelPaymentAccountChangeUseCase,
    private readonly sellInPersonUseCase: SellInPersonUseCase,
    private readonly deleteDraftRaffleUseCase: DeleteDraftRaffleUseCase,
  ) {}

  @Get('rifas')
  async listRaffles() {
    return (await this.queries.allRaffles()).map(present.raffleSummary);
  }


  @Delete('rifas/:id')
  @HttpCode(204)
  async deleteDraftRaffle(
    @CurrentUser() user: Principal,
    @Param('id') id: string,
  ) {
    await this.deleteDraftRaffleUseCase.execute({
      raffleId: parseWith(uuidParam, id),
      operatorId: operatorIdOf(user),
    });
  }

  @Get('rifas/:id/boletos-disponibles')
  async availableTickets(@Param('id') id: string) {
    const disponibles = await this.queries.availableTickets(parseWith(uuidParam, id));
    return { disponibles, numbers: disponibles };
  }
  @Get('rifas/:id')
  async raffleDetail(@Param('id') id: string) {
    return present.raffleSummary(await this.queries.adminRaffleDetail(parseWith(uuidParam, id)));
  }

  @Post('rifas')
  @HttpCode(201)
  async createRaffle(@Body() body: unknown) {
    const fields = parseWith(createRaffle, body);
    const raffle = await this.createRaffleUseCase.execute({
      id: randomUUID(),
      title: fields.titulo,
      prize: fields.premio,
      ticketPrice: fields.precio_boleto,
      numberMin: fields.numero_min,
      numberMax: fields.numero_max,
      winningAttempt: fields.intento_ganador,
      drawEffect: fields.efecto_sorteo,
      drawMode: fields.modalidad_sorteo,
      drawDurationSec: fields.duracion_efecto_seg,
      drawSpeed: fields.velocidad_efecto,
      prizeDescription: fields.descripcion_premio ?? null,
      prizeImages: fields.imagenes_premio,
    });
    return { rifa_id: raffle.id, estado: raffle.status };
  }

  @Patch('rifas/:id')
  async updateDraftRaffle(@Param('id') id: string, @Body() body: unknown) {
    const fields = parseWith(updateDraftRaffle, body);
    const raffle = await this.updateDraftRaffleUseCase.execute({
      raffleId: parseWith(uuidParam, id),
      title: fields.titulo,
      prize: fields.premio,
      ticketPrice: fields.precio_boleto,
      winningAttempt: fields.intento_ganador,
      drawEffect: fields.efecto_sorteo,
      drawMode: fields.modalidad_sorteo,
      drawDurationSec: fields.duracion_efecto_seg,
      drawSpeed: fields.velocidad_efecto,
      prizeDescription: fields.descripcion_premio,
      prizeImages: fields.imagenes_premio,
    });
    return {
      rifa_id: raffle.id,
      estado: raffle.status,
      titulo: raffle.title,
      premio: raffle.prize,
      precio_boleto: raffle.ticketPrice,
      intento_ganador: raffle.winningAttempt,
      efecto_sorteo: raffle.drawEffect,
      modalidad_sorteo: raffle.drawMode,
      duracion_efecto_seg: raffle.drawDurationSec,
      velocidad_efecto: raffle.drawSpeed,
      descripcion_premio: raffle.prizeDescription,
      imagenes_premio: raffle.prizeImages,
    };
  }

  @Post('rifas/:id/publicar')
  @HttpCode(200)
  async publish(@Param('id') id: string, @Body() body: unknown) {
    const fields = parseWith(publishRaffle, body);
    const raffle = await this.publishRaffleUseCase.execute({
      raffleId: parseWith(uuidParam, id),
      authorizationResolution: fields.resolucion_autorizacion,
      salesCloseAt: new Date(fields.cierre_ventas),
      drawAt: new Date(fields.fecha_sorteo),
    });
    return {
      rifa_id: raffle.id,
      estado: raffle.status,
      hash_compromiso: raffle.commitmentHash,
      ronda_drand: raffle.drandRound?.toString() ?? null,
    };
  }

  @Post('rifas/:id/venta-presencial')
  @HttpCode(201)
  async sellInPerson(
    @CurrentUser() user: Principal,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const fields = parseWith(inPersonSale, body);
    const order = await this.sellInPersonUseCase.execute({
      raffleId: parseWith(uuidParam, id),
      operatorId: operatorIdOf(user),
      numbers: fields.numeros,
      alias: fields.alias,
      phone: fields.telefono,
      document: fields.documento ?? null,
    });
    return present.orderOf(order);
  }

  @Get('rifas/:id/ventas')
  async sales(@Param('id') id: string) {
    return present.sales(await this.queries.salesReport(parseWith(uuidParam, id)));
  }

  @Get('rifas/:id/ordenes')
  async raffleOrders(@Param('id') id: string) {
    return this.queries.ordersWithBuyers(parseWith(uuidParam, id));
  }


  @Get('comprobantes')
  async allPendingProofs() {
    return (await this.queries.allPendingProofs()).map(present.pendingProof);
  }

  @Get('rifas/:id/comprobantes')
  async pendingProofs(@Param('id') id: string) {
    return (await this.queries.pendingProofs(parseWith(uuidParam, id))).map(present.pendingProof);
  }

  @Post('rifas/:id/sorteo')
  @HttpCode(200)
  async draw(@Param('id') id: string) {
    const draw = await this.executeDraw.execute(parseWith(uuidParam, id));
    return {
      sorteo_id: draw.id,
      numero_ganador: draw.winningNumber,
      ronda_drand: draw.drandRound.toString(),
      ejecutado_en: draw.executedAt.toISOString(),
    };
  }

  @Post('rifas/:id/cancelar-lista-alterada')
  @HttpCode(200)
  async cancelAltered(
    @CurrentUser() user: Principal,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const { motivo } = parseWith(cancelAltered, body);
    const raffle = await this.cancelAlteredUseCase.execute({
      raffleId: parseWith(uuidParam, id),
      operatorId: operatorIdOf(user),
      reason: motivo,
    });
    return { rifa_id: raffle.id, estado: raffle.status };
  }

  @Get('alertas')
  async alerts() {
    return (await this.listAlerts.execute()).map(present.alert);
  }

  @Post('alertas/:id/leida')
  @HttpCode(204)
  async readAlert(@CurrentUser() user: Principal, @Param('id') id: string) {
    await this.markAlertRead.execute({
      alertId: parseWith(uuidParam, id),
      operatorId: operatorIdOf(user),
    });
  }

  @Get('pagos-tardios')
  async lateClaims() {
    return (await this.listLateClaims.execute()).map(present.orderOf);
  }

  @Post('ordenes/:id/pago-tardio/confirmar')
  @HttpCode(204)
  async confirmLate(@CurrentUser() user: Principal, @Param('id') id: string, @Body() body: unknown) {
    const fields = parseWith(confirmLate, body);
    await this.confirmLatePayment.execute({
      orderId: parseWith(uuidParam, id),
      operatorId: operatorIdOf(user),
      ...receivedMoney(fields),
    });
  }

  @Post('ordenes/:id/pago-tardio/descartar')
  @HttpCode(204)
  async dismissLate(@CurrentUser() user: Principal, @Param('id') id: string, @Body() body: unknown) {
    const { motivo } = parseWith(dismiss, body);
    await this.dismissLatePayment.execute({
      orderId: parseWith(uuidParam, id),
      operatorId: operatorIdOf(user),
      reason: motivo,
    });
  }

  @Post('ordenes/:id/aprobar')
  @HttpCode(204)
  async approve(@CurrentUser() user: Principal, @Param('id') id: string, @Body() body: unknown) {
    const fields = parseWith(approve, body);
    await this.approvePayment.execute({
      orderId: parseWith(uuidParam, id),
      operatorId: operatorIdOf(user),
      operationNumber: fields.numero_operacion,
      receivedAmount: fields.monto_recibido,
      collision: fields.colision
        ? { reason: fields.colision.motivo, bank: fields.colision.banco }
        : null,
    });
  }

  @Get('pagos/colisiones')
  async collisions() {
    return (await this.listCollisions.execute()).map(present.collision);
  }

  @Post('ordenes/:id/rechazar')
  @HttpCode(204)
  async reject(@CurrentUser() user: Principal, @Param('id') id: string, @Body() body: unknown) {
    const fields = parseWith(reject, body);
    const base = {
      orderId: parseWith(uuidParam, id),
      operatorId: operatorIdOf(user),
      reason: fields.motivo,
    };
    await this.rejectPayment.execute(
      fields.dinero_recibido
        ? { ...base, moneyReceived: true, ...receivedMoney(fields) }
        : { ...base, moneyReceived: false },
    );
  }

  @Post('ordenes/:id/transferencia-extra')
  @HttpCode(204)
  async extraTransfer(@CurrentUser() user: Principal, @Param('id') id: string, @Body() body: unknown) {
    const fields = parseWith(extraTransfer, body);
    await this.recordExtraTransfer.execute({
      orderId: parseWith(uuidParam, id),
      operatorId: operatorIdOf(user),
      reason: fields.motivo,
      ...receivedMoney(fields),
    });
  }

  @Get('reembolsos')
  async pendingRefunds() {
    return (await this.listPendingRefunds.execute()).map(present.refund);
  }

  @Post('reembolsos/:id/completar')
  @HttpCode(204)
  async completeRefund(@CurrentUser() user: Principal, @Param('id') id: string, @Body() body: unknown) {
    const fields = parseWith(completeRefund, body);
    await this.completeRefundUseCase.execute({
      refundId: parseWith(uuidParam, id),
      operatorId: operatorIdOf(user),
      destination: fields.destino,
      operationNumber: fields.numero_operacion,
    });
  }

  @Post('notificaciones/:id/reencolar')
  @HttpCode(204)
  async requeue(@CurrentUser() user: Principal, @Param('id') id: string) {
    await this.requeueNotification.execute({
      notificationId: parseWith(uuidParam, id),
      operatorId: operatorIdOf(user),
    });
  }

  // ------------------------------------------- payment accounts (DT-19)

  @Get('cuentas-pago')
  async paymentAccounts() {
    return (await this.listAccounts.execute({ includeInactive: true })).map(present.adminPaymentAccount);
  }

  /** Four eyes: the new account is only proposed (202), never public yet. */
  @Post('cuentas-pago')
  @HttpCode(202)
  async proposePaymentAccount(@CurrentUser() user: Principal, @Body() body: unknown) {
    const fields = parseWith(createAccount, body);
    const change = await this.proposeAccountUseCase.execute({
      operatorId: operatorIdOf(user),
      fields: {
        method: fields.metodo,
        holderName: fields.titular,
        accountNumber: fields.numero,
        cci: fields.cci ?? null,
        displayOrder: fields.orden,
      },
    });
    return present.paymentAccountChange(change);
  }

  /** A pure reorder applies at once (200); anything else is proposed (202). */
  @Patch('cuentas-pago/:id')
  async updatePaymentAccount(
    @CurrentUser() user: Principal,
    @Param('id') id: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const fields = parseWith(updateAccount, body);
    const outcome = await this.updateAccountUseCase.execute({
      accountId: parseWith(uuidParam, id),
      operatorId: operatorIdOf(user),
      changes: accountChanges(fields),
    });
    return answer(outcome, response);
  }

  /** The safe direction: applies at once. */
  @Post('cuentas-pago/:id/desactivar')
  async deactivatePaymentAccount(
    @CurrentUser() user: Principal,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    return answer(await this.setActive(user, id, false), response);
  }

  /** Sends money there again: proposed (202) unless already active (200). */
  @Post('cuentas-pago/:id/activar')
  async activatePaymentAccount(
    @CurrentUser() user: Principal,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    return answer(await this.setActive(user, id, true), response);
  }

  @Get('cuentas-pago/cambios')
  async pendingPaymentAccountChanges() {
    return (await this.listAccountChanges.execute()).map(present.paymentAccountChange);
  }

  /** Another operator than the proposer; the account as buyers now see it. */
  @Post('cuentas-pago/cambios/:id/aprobar')
  @HttpCode(200)
  async approvePaymentAccountChange(@CurrentUser() user: Principal, @Param('id') id: string) {
    const { account } = await this.approveAccountChange.execute({
      changeId: parseWith(uuidParam, id),
      operatorId: operatorIdOf(user),
    });
    return present.adminPaymentAccount(account);
  }

  @Post('cuentas-pago/cambios/:id/rechazar')
  @HttpCode(200)
  async rejectPaymentAccountChange(@CurrentUser() user: Principal, @Param('id') id: string) {
    const change = await this.rejectAccountChange.execute({
      changeId: parseWith(uuidParam, id),
      operatorId: operatorIdOf(user),
    });
    return present.paymentAccountChange(change);
  }

  /** Only the proposer withdraws a change. */
  @Post('cuentas-pago/cambios/:id/cancelar')
  @HttpCode(200)
  async cancelPaymentAccountChange(@CurrentUser() user: Principal, @Param('id') id: string) {
    const change = await this.cancelAccountChange.execute({
      changeId: parseWith(uuidParam, id),
      operatorId: operatorIdOf(user),
    });
    return present.paymentAccountChange(change);
  }

  private setActive(user: Principal, id: string, active: boolean): Promise<PaymentAccountOutcome> {
    return this.setAccountActive.execute({
      accountId: parseWith(uuidParam, id),
      operatorId: operatorIdOf(user),
      active,
    });
  }
}

/** 200 with the account when applied, 202 with the change when proposed. */
function answer(outcome: PaymentAccountOutcome, response: Response) {
  if (outcome.pending) {
    response.status(202);
    return present.paymentAccountChange(outcome.pending);
  }
  response.status(200);
  return present.adminPaymentAccount(outcome.applied!);
}
