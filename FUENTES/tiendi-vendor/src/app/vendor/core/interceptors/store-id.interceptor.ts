import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Placeholder interceptor for storeId context.
 * The router handles :storeId path params automatically.
 * Services are responsible for injecting storeId as query params where needed.
 * This interceptor is intentionally a pass-through — kept in the chain for
 * future use (e.g., custom store-id header for multi-tenant endpoints).
 */
export const storeIdInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req);
};
