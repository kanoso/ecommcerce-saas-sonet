import { ErrorHandler, Injectable } from '@angular/core';
import * as Sentry from '@sentry/angular';

@Injectable()
export class SentryAppErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    Sentry.captureException(error);
    console.error(error);
  }
}
