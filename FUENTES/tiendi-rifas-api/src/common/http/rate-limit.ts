import { applyDecorators, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ClientIpThrottlerGuard } from './client-ip-throttler.guard';

/** The named limits of guide §6.5, point 3. Configured in ThrottlerModule. */
export const RATE_LIMITS = ['reservation', 'proof', 'magicLink', 'auth'] as const;
export type RateLimitName = (typeof RATE_LIMITS)[number];

/** Applies one named limit to a route, and none of the others. */
export function RateLimit(name: RateLimitName) {
  const skipped = Object.fromEntries(
    RATE_LIMITS.filter((other) => other !== name).map((other) => [other, true]),
  );
  return applyDecorators(UseGuards(ClientIpThrottlerGuard), SkipThrottle(skipped));
}
