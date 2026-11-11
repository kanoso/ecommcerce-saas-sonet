import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { SessionStore } from '../session/session.store';
import { API_BASE_URL } from './api-config';
import { rethrowAsApiError } from './api-error';
import {
  AdminPaymentAccountDto,
  AdminRefundDto,
  AdminSalesReportDto,
  RaffleOrderWithBuyerDto,
  ApprovePaymentRequestDto,
  CancelRaffleResponseDto,
  CompleteRefundRequestDto,
  ConfirmLatePaymentRequestDto,
  CreateAccountProposalRequestDto,
  CreateRaffleDto,
  UpdateDraftRaffleDto,
  CreatedRaffleDto,
  DismissLatePaymentRequestDto,
  ExecuteDrawDto,
  OperationCollisionDto,
  OperatorAlertDto,
  OrderDto,
  PaymentAccountChangeDto,
  PendingProofDto,
  PublishRaffleDto,
  PublishedRaffleDto,
  RaffleSummaryDto,
  RecordExtraTransferRequestDto,
  RejectPaymentRequestDto,
  UpdateAccountProposalRequestDto,
} from './api.dto';
import {
  toAdminPaymentAccount,
  toAdminRefund,
  toAdminSalesReport,
  toRaffleOrderWithBuyer,
  toCreatedRaffle,
  toExecuteDrawResult,
  toInPersonSaleDto,
  toOperationCollision,
  toOperatorAlert,
  toOrder,
  toPaymentAccountChange,
  toPendingProof,
  toPublishedRaffle,
  toRaffleSummary,
} from './api.mappers';
import {
  AdminPaymentAccount,
  AdminRefund,
  AdminSalesReport,
  RaffleOrderWithBuyer,
  CreatedRaffle,
  ExecuteDrawResult,
  InPersonSaleRequest,
  OperationCollision,
  OperatorAlert,
  Order,
  PaymentAccountChange,
  PendingProof,
  PublishedRaffle,
  RaffleSummary,
} from './api.models';

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly session = inject(SessionStore);

  /**
   * URL to view or download the proof file.
   */
  proofFileUrl(orderId: string): string {
    const token = this.session.activeToken();
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${this.baseUrl}/ordenes/${encodeURIComponent(orderId)}/comprobante${query}`;
  }

  /**
   * `GET /admin/alertas` (DT-09): unread operator alerts.
   */
  alerts(): Observable<OperatorAlert[]> {
    return this.http
      .get<OperatorAlertDto[]>(`${this.baseUrl}/admin/alertas`)
      .pipe(map((dtos) => dtos.map(toOperatorAlert)), catchError(rethrowAsApiError));
  }

  /**
   * `POST /admin/alertas/:id/leida`: marks an alert read.
   */
  markAlertRead(alertId: string): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/admin/alertas/${encodeURIComponent(alertId)}/leida`, {})
      .pipe(catchError(rethrowAsApiError));
  }

  /**
   * `GET /admin/rifas`: lists all raffles in any status for operators.
   */
  listRaffles(): Observable<RaffleSummary[]> {
    return this.http
      .get<RaffleSummaryDto[]>(`${this.baseUrl}/admin/rifas`)
      .pipe(map((dtos) => dtos.map(toRaffleSummary)), catchError(rethrowAsApiError));
  }

  /**
   * `GET /admin/rifas/:id`: raffle summary in any status for operators (including DRAFT).
   */
  raffleDetail(raffleId: string): Observable<RaffleSummary> {
    return this.http
      .get<RaffleSummaryDto>(`${this.baseUrl}/admin/rifas/${encodeURIComponent(raffleId)}`)
      .pipe(map(toRaffleSummary), catchError(rethrowAsApiError));
  }

  /**
   * `POST /admin/rifas` (RF-10): creates a new raffle in DRAFT.
   */
  createRaffle(body: CreateRaffleDto): Observable<CreatedRaffle> {
    return this.http
      .post<CreatedRaffleDto>(`${this.baseUrl}/admin/rifas`, body)
      .pipe(map(toCreatedRaffle), catchError(rethrowAsApiError));
  }

  /**
   * `PATCH /admin/rifas/:id`: updates draft raffle details, specifications and showcase.
   */
  updateDraftRaffle(raffleId: string, body: UpdateDraftRaffleDto): Observable<unknown> {
    return this.http
      .patch(`${this.baseUrl}/admin/rifas/${encodeURIComponent(raffleId)}`, body)
      .pipe(catchError(rethrowAsApiError));
  }

  /**
   * `DELETE /admin/rifas/:id`: deletes a raffle in DRAFT state.
   */
  deleteDraftRaffle(raffleId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/admin/rifas/${encodeURIComponent(raffleId)}`)
      .pipe(catchError(rethrowAsApiError));
  }

  /**
   * `GET /admin/rifas/:id/boletos-disponibles`: list available ticket numbers.
   */
  availableTickets(raffleId: string): Observable<number[]> {
    return this.http
      .get<{ disponibles?: number[]; numbers?: number[] }>(`${this.baseUrl}/admin/rifas/${encodeURIComponent(raffleId)}/boletos-disponibles`)
      .pipe(
        map((res) => res.disponibles ?? res.numbers ?? []),
        catchError(rethrowAsApiError),
      );
  }

  /**
   * `POST /admin/rifas/:id/publicar` (RF-11): publishes raffle, generates commitment and locks seed/round.
   */
  publishRaffle(raffleId: string, body: PublishRaffleDto): Observable<PublishedRaffle> {
    return this.http
      .post<PublishedRaffleDto>(`${this.baseUrl}/admin/rifas/${encodeURIComponent(raffleId)}/publicar`, body)
      .pipe(map(toPublishedRaffle), catchError(rethrowAsApiError));
  }

  /**
   * `GET /admin/rifas/:id/ventas` (RF-12): sales and tickets progress metrics.
   */
  salesReport(raffleId: string): Observable<AdminSalesReport> {
    return this.http
      .get<AdminSalesReportDto>(`${this.baseUrl}/admin/rifas/${encodeURIComponent(raffleId)}/ventas`)
      .pipe(map(toAdminSalesReport), catchError(rethrowAsApiError));
  }

  /**
   * `POST /admin/rifas/:id/venta-presencial`: direct in-person ticket sale.
   */
  sellInPerson(raffleId: string, req: InPersonSaleRequest): Observable<Order> {
    const body = toInPersonSaleDto(req);
    return this.http
      .post<OrderDto>(
        `${this.baseUrl}/admin/rifas/${encodeURIComponent(raffleId)}/venta-presencial`,
        body,
      )
      .pipe(map(toOrder), catchError(rethrowAsApiError));
  }

  /**
   * `POST /admin/rifas/:id/sorteo` (RF-13): manual draw execution trigger.
   */
  executeDraw(raffleId: string): Observable<ExecuteDrawResult> {
    return this.http
      .post<ExecuteDrawDto>(`${this.baseUrl}/admin/rifas/${encodeURIComponent(raffleId)}/sorteo`, {})
      .pipe(map(toExecuteDrawResult), catchError(rethrowAsApiError));
  }

  /**
   * `POST /admin/rifas/:id/cancelar-lista-alterada` (RF-15 / DT-15): cancels raffle with refunds.
   */
  cancelAlteredRaffle(raffleId: string, reason: string): Observable<CreatedRaffle> {
    return this.http
      .post<CancelRaffleResponseDto>(`${this.baseUrl}/admin/rifas/${encodeURIComponent(raffleId)}/cancelar-lista-alterada`, { motivo: reason })
      .pipe(map(toCreatedRaffle), catchError(rethrowAsApiError));
  }

  /**
   * `GET /admin/comprobantes` (RF-16): all pending proofs waiting for review.
   */
  /**
   * `GET /admin/rifas/:id/ordenes`: orders with buyer details of a specific raffle.
   */
  raffleOrders(raffleId: string): Observable<RaffleOrderWithBuyer[]> {
    return this.http
      .get<RaffleOrderWithBuyerDto[]>(
        `${this.baseUrl}/admin/rifas/${encodeURIComponent(raffleId)}/ordenes`
      )
      .pipe(map((dtos) => dtos.map(toRaffleOrderWithBuyer)), catchError(rethrowAsApiError));
  }

  pendingProofs(): Observable<PendingProof[]> {
    return this.http
      .get<PendingProofDto[]>(`${this.baseUrl}/admin/comprobantes`)
      .pipe(map((dtos) => dtos.map(toPendingProof)), catchError(rethrowAsApiError));
  }

  /**
   * `GET /admin/rifas/:id/comprobantes`: pending proofs of a specific raffle.
   */
  rafflePendingProofs(raffleId: string): Observable<PendingProof[]> {
    return this.http
      .get<PendingProofDto[]>(`${this.baseUrl}/admin/rifas/${encodeURIComponent(raffleId)}/comprobantes`)
      .pipe(map((dtos) => dtos.map(toPendingProof)), catchError(rethrowAsApiError));
  }

  /**
   * `POST /admin/ordenes/:id/aprobar` (DT-12): approves payment with operation number.
   */
  approvePayment(orderId: string, body: ApprovePaymentRequestDto): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/admin/ordenes/${encodeURIComponent(orderId)}/aprobar`, body)
      .pipe(catchError(rethrowAsApiError));
  }

  /**
   * `POST /admin/ordenes/:id/rechazar` (DT-08 / DT-14): rejects payment.
   */
  rejectPayment(orderId: string, body: RejectPaymentRequestDto): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/admin/ordenes/${encodeURIComponent(orderId)}/rechazar`, body)
      .pipe(catchError(rethrowAsApiError));
  }

  /**
   * `POST /admin/ordenes/:id/transferencia-extra` (DT-16): records second transfer and opens refund.
   */
  recordExtraTransfer(orderId: string, body: RecordExtraTransferRequestDto): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/admin/ordenes/${encodeURIComponent(orderId)}/transferencia-extra`, body)
      .pipe(catchError(rethrowAsApiError));
  }

  /**
   * `GET /admin/pagos-tardios` (DT-07 / DT-10): late claims and expired unverified proofs.
   */
  latePaymentClaims(): Observable<Order[]> {
    return this.http
      .get<OrderDto[]>(`${this.baseUrl}/admin/pagos-tardios`)
      .pipe(map((dtos) => dtos.map(toOrder)), catchError(rethrowAsApiError));
  }

  /**
   * `POST /admin/ordenes/:id/pago-tardio/confirmar` (DT-07): confirms money received and opens refund.
   */
  confirmLatePayment(orderId: string, body: ConfirmLatePaymentRequestDto): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/admin/ordenes/${encodeURIComponent(orderId)}/pago-tardio/confirmar`, body)
      .pipe(catchError(rethrowAsApiError));
  }

  /**
   * `POST /admin/ordenes/:id/pago-tardio/descartar`: discards late payment claim.
   */
  dismissLatePayment(orderId: string, body: DismissLatePaymentRequestDto): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/admin/ordenes/${encodeURIComponent(orderId)}/pago-tardio/descartar`, body)
      .pipe(catchError(rethrowAsApiError));
  }

  /**
   * `GET /admin/reembolsos` (DT-04 / DT-17): pending refunds.
   */
  pendingRefunds(): Observable<AdminRefund[]> {
    return this.http
      .get<AdminRefundDto[]>(`${this.baseUrl}/admin/reembolsos`)
      .pipe(map((dtos) => dtos.map(toAdminRefund)), catchError(rethrowAsApiError));
  }

  /**
   * `POST /admin/reembolsos/:id/completar` (DT-17): marks refund completed (four-eyes).
   */
  completeRefund(refundId: string, body: CompleteRefundRequestDto): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/admin/reembolsos/${encodeURIComponent(refundId)}/completar`, body)
      .pipe(catchError(rethrowAsApiError));
  }

  /**
   * `GET /admin/cuentas-pago` (DT-19): all payment accounts including inactive.
   */
  paymentAccounts(): Observable<AdminPaymentAccount[]> {
    return this.http
      .get<AdminPaymentAccountDto[]>(`${this.baseUrl}/admin/cuentas-pago`)
      .pipe(map((dtos) => dtos.map(toAdminPaymentAccount)), catchError(rethrowAsApiError));
  }

  /**
   * `POST /admin/cuentas-pago` (DT-19): proposes a new account (four-eyes, 202).
   */
  proposePaymentAccount(body: CreateAccountProposalRequestDto): Observable<PaymentAccountChange> {
    return this.http
      .post<PaymentAccountChangeDto>(`${this.baseUrl}/admin/cuentas-pago`, body)
      .pipe(map(toPaymentAccountChange), catchError(rethrowAsApiError));
  }

  /**
   * `PATCH /admin/cuentas-pago/:id` (DT-19): updates account or proposes changes.
   */
  updatePaymentAccount(accountId: string, body: UpdateAccountProposalRequestDto): Observable<AdminPaymentAccount | PaymentAccountChange> {
    return this.http
      .patch<AdminPaymentAccountDto | PaymentAccountChangeDto>(`${this.baseUrl}/admin/cuentas-pago/${encodeURIComponent(accountId)}`, body)
      .pipe(
        map((res) => ('solicitud_id' in res ? toPaymentAccountChange(res) : toAdminPaymentAccount(res))),
        catchError(rethrowAsApiError),
      );
  }

  /**
   * `POST /admin/cuentas-pago/:id/desactivar`: deactivates account immediately.
   */
  deactivatePaymentAccount(accountId: string): Observable<AdminPaymentAccount | PaymentAccountChange> {
    return this.http
      .post<AdminPaymentAccountDto | PaymentAccountChangeDto>(`${this.baseUrl}/admin/cuentas-pago/${encodeURIComponent(accountId)}/desactivar`, {})
      .pipe(
        map((res) => ('solicitud_id' in res ? toPaymentAccountChange(res) : toAdminPaymentAccount(res))),
        catchError(rethrowAsApiError),
      );
  }

  /**
   * `POST /admin/cuentas-pago/:id/activar`: proposes reactivating account.
   */
  activatePaymentAccount(accountId: string): Observable<AdminPaymentAccount | PaymentAccountChange> {
    return this.http
      .post<AdminPaymentAccountDto | PaymentAccountChangeDto>(`${this.baseUrl}/admin/cuentas-pago/${encodeURIComponent(accountId)}/activar`, {})
      .pipe(
        map((res) => ('solicitud_id' in res ? toPaymentAccountChange(res) : toAdminPaymentAccount(res))),
        catchError(rethrowAsApiError),
      );
  }

  /**
   * `GET /admin/cuentas-pago/cambios` (DT-19): pending account proposals.
   */
  pendingAccountChanges(): Observable<PaymentAccountChange[]> {
    return this.http
      .get<PaymentAccountChangeDto[]>(`${this.baseUrl}/admin/cuentas-pago/cambios`)
      .pipe(map((dtos) => dtos.map(toPaymentAccountChange)), catchError(rethrowAsApiError));
  }

  /**
   * `POST /admin/cuentas-pago/cambios/:id/aprobar` (DT-19): approves change by another operator.
   */
  approveAccountChange(changeId: string): Observable<AdminPaymentAccount> {
    return this.http
      .post<AdminPaymentAccountDto>(`${this.baseUrl}/admin/cuentas-pago/cambios/${encodeURIComponent(changeId)}/aprobar`, {})
      .pipe(map(toAdminPaymentAccount), catchError(rethrowAsApiError));
  }

  /**
   * `POST /admin/cuentas-pago/cambios/:id/rechazar` (DT-19): rejects change by another operator.
   */
  rejectAccountChange(changeId: string): Observable<PaymentAccountChange> {
    return this.http
      .post<PaymentAccountChangeDto>(`${this.baseUrl}/admin/cuentas-pago/cambios/${encodeURIComponent(changeId)}/rechazar`, {})
      .pipe(map(toPaymentAccountChange), catchError(rethrowAsApiError));
  }

  /**
   * `POST /admin/cuentas-pago/cambios/:id/cancelar` (DT-19): withdraws change by proposer.
   */
  cancelAccountChange(changeId: string): Observable<PaymentAccountChange> {
    return this.http
      .post<PaymentAccountChangeDto>(`${this.baseUrl}/admin/cuentas-pago/cambios/${encodeURIComponent(changeId)}/cancelar`, {})
      .pipe(map(toPaymentAccountChange), catchError(rethrowAsApiError));
  }

  /**
   * `GET /admin/pagos/colisiones` (DT-12): operation collisions list.
   */
  collisions(): Observable<OperationCollision[]> {
    return this.http
      .get<OperationCollisionDto[]>(`${this.baseUrl}/admin/pagos/colisiones`)
      .pipe(map((dtos) => dtos.map(toOperationCollision)), catchError(rethrowAsApiError));
  }
}
