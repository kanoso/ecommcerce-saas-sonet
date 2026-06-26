import * as Sentry from '@sentry/angular';
import { environment } from './environments/environment';

if (environment.sentryDsn) {
  Sentry.init({
    dsn: environment.sentryDsn,
    environment: environment.production ? 'production' : 'development',
    tracesSampleRate: environment.production ? 0.1 : 0,
    sendDefaultPii: false,

    beforeSend(event) {
      // Remove user PII — keep only an anonymized id if present
      if (event.user) {
        const { email: _email, ip_address: _ip, username: _name, ...safeUser } = event.user;
        event.user = safeUser;
      }
      return event;
    },
  });
}
