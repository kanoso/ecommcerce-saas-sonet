import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { PaymentAccountDto } from './api.dto';
import { rethrowAsApiError } from './api-error';
import { toPaymentAccount } from './api.mappers';
import { PaymentAccount } from './api.models';

/** Public route: where buyers transfer, as operators set it (DT-19). */
@Injectable({ providedIn: 'root' })
export class PaymentAccountsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /cuentas-pago`: the active accounts, already in display order. */
  list(): Observable<PaymentAccount[]> {
    return this.http.get<PaymentAccountDto[]>(`${this.baseUrl}/cuentas-pago`).pipe(
      map((accounts) => accounts.map(toPaymentAccount)),
      catchError(rethrowAsApiError),
    );
  }
}
