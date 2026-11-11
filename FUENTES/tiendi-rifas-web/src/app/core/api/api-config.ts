import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Base URL of tiendi-rifas-api, including its `/api` prefix. No trailing slash. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl,
});

/** Google Sign-In web client id. Must match tiendi-rifas-api's GOOGLE_CLIENT_ID. */
export const GOOGLE_CLIENT_ID = new InjectionToken<string>('GOOGLE_CLIENT_ID', {
  providedIn: 'root',
  factory: () => environment.googleClientId,
});
