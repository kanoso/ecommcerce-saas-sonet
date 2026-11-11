import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { LiveDataDto, RaffleDetailDto, RaffleSummaryDto, VerificationDataDto } from './api.dto';
import { rethrowAsApiError } from './api-error';
import {
  toCommitment,
  toLiveRaffleData,
  toRaffleDetail,
  toRaffleStatusInfo,
  toRaffleSummary,
  toVerificationData,
} from './api.mappers';
import { Commitment, LiveRaffleData, RaffleDetail, RaffleStatusInfo, RaffleSummary, VerificationData } from './api.models';

/** Public raffle routes. Errors always surface as ApiError. */
@Injectable({ providedIn: 'root' })
export class RafflesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listActive(): Observable<RaffleSummary[]> {
    return this.http.get<RaffleSummaryDto[]>(`${this.baseUrl}/rifas`).pipe(
      map((list) => list.map(toRaffleSummary)),
      catchError(rethrowAsApiError),
    );
  }

  listFinished(): Observable<RaffleSummary[]> {
    return this.http.get<RaffleSummaryDto[]>(`${this.baseUrl}/rifas/finalizadas`).pipe(
      map((list) => list.map(toRaffleSummary)),
      catchError(rethrowAsApiError),
    );
  }

  /** The raffle and one page of its grid (`pagina` from 1, `tamano` 1 to 200). */
  detail(raffleId: string, page: number, pageSize: number): Observable<RaffleDetail> {
    return this.http
      .get<RaffleDetailDto>(this.raffleUrl(raffleId), { params: { pagina: page, tamano: pageSize } })
      .pipe(map(toRaffleDetail), catchError(rethrowAsApiError));
  }

  /** The commitment hash and drand round, read from the public live data. */
  commitment(raffleId: string): Observable<Commitment> {
    return this.http
      .get<LiveDataDto>(`${this.raffleUrl(raffleId)}/en-vivo`)
      .pipe(map(toCommitment), catchError(rethrowAsApiError));
  }

  /** The frozen data and official result; 409 DRAW_NOT_POSSIBLE until the draw exists. */
  verification(raffleId: string): Observable<VerificationData> {
    return this.http
      .get<VerificationDataDto>(`${this.raffleUrl(raffleId)}/verificacion`)
      .pipe(map(toVerificationData), catchError(rethrowAsApiError));
  }

  /** The title and status of a raffle, read from the public live data. */
  statusInfo(raffleId: string): Observable<RaffleStatusInfo> {
    return this.http
      .get<LiveDataDto>(`${this.raffleUrl(raffleId)}/en-vivo`)
      .pipe(map(toRaffleStatusInfo), catchError(rethrowAsApiError));
  }

  /** The full live data of a raffle (spec §11 GET /api/rifas/:id/en-vivo). */
  live(raffleId: string): Observable<LiveRaffleData> {
    return this.http
      .get<LiveDataDto>(`${this.raffleUrl(raffleId)}/en-vivo`)
      .pipe(map(toLiveRaffleData), catchError(rethrowAsApiError));
  }

  private raffleUrl(raffleId: string): string {
    return `${this.baseUrl}/rifas/${encodeURIComponent(raffleId)}`;
  }
}
