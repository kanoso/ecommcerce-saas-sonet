import {
  APP_INITIALIZER,
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { SentryAppErrorHandler } from './vendor/core/services/sentry-error-handler';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { routes } from './app.routes';
import { authInterceptor } from './vendor/core/interceptors/auth.interceptor';
import { storeIdInterceptor } from './vendor/core/interceptors/store-id.interceptor';
import { errorInterceptor } from './vendor/core/interceptors/error.interceptor';
import { loadingInterceptor } from './vendor/core/interceptors/loading.interceptor';
import { retryInterceptor } from './vendor/core/interceptors/retry.interceptor';
import { AuthStore } from './vendor/core/services/auth.store';
import { environment } from '../environments/environment';

/**
 * Application configuration for the Angular bootstrap.
 * Provides router, HTTP client with interceptors, charts library, and auth initialization.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ErrorHandler, useClass: SentryAppErrorHandler },
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([
        authInterceptor,
        storeIdInterceptor,
        errorInterceptor,
        loadingInterceptor,
        retryInterceptor,
      ]),
    ),
    provideCharts(withDefaultRegisterables()),
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const auth = inject(AuthStore);
        return () => auth.loadFromStorage();
      },
      multi: true,
    },
  ],
};
