import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Base URL of tiendi-rifas-api, including its `/api` prefix. No trailing slash. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl,
});
