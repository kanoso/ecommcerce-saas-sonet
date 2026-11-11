import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { LinkRequestedDto, SessionDto } from './api.dto';
import { rethrowAsApiError } from './api-error';
import { toSession } from './api.mappers';
import { Session } from './api.models';

/**
 * Magic-link access (D4): `POST /auth/enlace` mails a one-time link,
 * `POST /auth/sesion` trades its token for a bearer session.
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Always accepted (202), whether or not the address exists. */
  requestLink(email: string): Observable<void> {
    return this.http
      .post<LinkRequestedDto>(`${this.baseUrl}/auth/enlace`, { email })
      .pipe(map(() => undefined), catchError(rethrowAsApiError));
  }

  openSession(token: string): Observable<Session> {
    return this.http
      .post<SessionDto>(`${this.baseUrl}/auth/sesion`, { token })
      .pipe(map(toSession), catchError(rethrowAsApiError));
  }

  loginWithGoogle(idToken: string): Observable<Session> {
    return this.http
      .post<SessionDto>(`${this.baseUrl}/auth/google`, { idToken })
      .pipe(map(toSession), catchError(rethrowAsApiError));
  }

  register(identifier: string, password: string, name?: string): Observable<Session> {
    return this.http
      .post<SessionDto>(`${this.baseUrl}/auth/registro`, { identifier, password, name })
      .pipe(map(toSession), catchError(rethrowAsApiError));
  }

  login(identifier: string, password: string): Observable<Session> {
    return this.http
      .post<SessionDto>(`${this.baseUrl}/auth/login`, { identifier, password })
      .pipe(map(toSession), catchError(rethrowAsApiError));
  }

  signOut(): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/auth/salir`, null)
      .pipe(map(() => undefined), catchError(rethrowAsApiError));
  }
}
