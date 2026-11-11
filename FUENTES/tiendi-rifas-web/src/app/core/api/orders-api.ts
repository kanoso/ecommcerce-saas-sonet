import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { centsToAmountText } from '../money/amount-text';
import { API_BASE_URL } from './api-config';
import { MyTicketDto, OrderDto, ReservationRequestDto } from './api.dto';
import { rethrowAsApiError } from './api-error';
import { serverTimeOf, toMyTicket, toOrder } from './api.mappers';
import { BankOrWallet, MyTicket, Order } from './api.models';

/** An order read, with what the countdown needs to find the server time. */
export interface OrderRead {
  order: Order;
  /** `hora_servidor` of the answer: the server clock; null if unreadable. */
  serverTime: Date | null;
  /** Local `Date.now()` when the response arrived. */
  receivedAt: number;
}

export interface LatePaymentClaim {
  file: File | null;
  operationNumber: string;
  bankOrWallet: BankOrWallet;
  declaredAmountCents: number;
}

export interface ProofSubmission {
  file: File | null;
  operationNumber: string;
  bankOrWallet: BankOrWallet;
  declaredAmountCents: number;
  /** `cuenta_id`: the operator account the buyer paid to. */
  paymentAccountId: string;
  /** `cuenta_version`: the version of that account the buyer saw. */
  paymentAccountVersion: number;
}

/**
 * Buyer routes (SessionGuard): the bearer token comes from authInterceptor.
 * `POST /reservas` is rate limited per IP (429 TOO_MANY_REQUESTS) and answers
 * 409 TICKETS_UNAVAILABLE, without listing the numbers, when any is taken.
 */
@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  reserve(raffleId: string, numbers: number[]): Observable<Order> {
    const body: ReservationRequestDto = { rifa_id: raffleId, numeros: numbers };
    return this.http
      .post<OrderDto>(`${this.baseUrl}/reservas`, body)
      .pipe(map(toOrder), catchError(rethrowAsApiError));
  }

  /** `GET /mis-boletos`: only the session user's orders, newest first. */
  myTickets(): Observable<MyTicket[]> {
    return this.http
      .get<MyTicketDto[]>(`${this.baseUrl}/mis-boletos`)
      .pipe(map((tickets) => tickets.map(toMyTicket)), catchError(rethrowAsApiError));
  }

  /** `GET /ordenes/:id`. Another buyer's order answers 404 ORDER_NOT_FOUND. */
  order(orderId: string): Observable<OrderRead> {
    return this.http
      .get<OrderDto>(`${this.baseUrl}/ordenes/${encodeURIComponent(orderId)}`)
      .pipe(map(toOrderRead), catchError(rethrowAsApiError));
  }

  /**
   * `POST /ordenes/:id/comprobante` (multipart, rate limited). The body is
   * strict: the file and the operation number are sent only when present,
   * and the amount as decimal soles.
   */
  submitProof(orderId: string, proof: ProofSubmission): Observable<OrderRead> {
    const body = new FormData();
    if (proof.file) {
      body.append('archivo', proof.file, proof.file.name);
    }
    const operationNumber = proof.operationNumber.trim();
    if (operationNumber !== '') {
      body.append('numero_operacion', operationNumber);
    }
    body.append('banco_o_billetera', proof.bankOrWallet);
    body.append('monto_declarado', centsToAmountText(proof.declaredAmountCents));
    body.append('cuenta_id', proof.paymentAccountId);
    body.append('cuenta_version', String(proof.paymentAccountVersion));
    return this.http
      .post<OrderDto>(`${this.baseUrl}/ordenes/${encodeURIComponent(orderId)}/comprobante`, body)
      .pipe(map(toOrderRead), catchError(rethrowAsApiError));
  }

  /**
   * `POST /ordenes/:id/pago-tardio` (multipart, rate limited). Claims a payment
   * made on an EXPIRED order (DT-07).
   */
  claimLatePayment(orderId: string, claim: LatePaymentClaim): Observable<OrderRead> {
    const body = new FormData();
    if (claim.file) {
      body.append('archivo', claim.file, claim.file.name);
    }
    const operationNumber = claim.operationNumber.trim();
    if (operationNumber !== '') {
      body.append('numero_operacion', operationNumber);
    }
    body.append('banco_o_billetera', claim.bankOrWallet);
    body.append('monto_declarado', centsToAmountText(claim.declaredAmountCents));
    return this.http
      .post<OrderDto>(`${this.baseUrl}/ordenes/${encodeURIComponent(orderId)}/pago-tardio`, body)
      .pipe(map(toOrderRead), catchError(rethrowAsApiError));
  }
}

/** The server clock travels in the body, so no CORS header has to expose it. */
function toOrderRead(dto: OrderDto): OrderRead {
  return { order: toOrder(dto), serverTime: serverTimeOf(dto), receivedAt: Date.now() };
}
