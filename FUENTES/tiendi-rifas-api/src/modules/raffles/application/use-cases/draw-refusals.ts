import { AuditEvent } from '../../domain';

/** The audit type of every refused draw attempt. */
export const DRAW_REFUSED = 'DRAW_REFUSED';

/**
 * Refusals of a v2 draw for its configuration (DT-21): frozen once the drand
 * round was already public, no longer matching the frozen hash, or never
 * frozen. None of them can be fixed by trying again, so the raffle is
 * cancelled with a full refund.
 */
export const DrawConfigRefusal = {
  FROZEN_LATE: 'DRAW_CONFIG_FROZEN_LATE',
  MISMATCH: 'DRAW_CONFIG_MISMATCH',
  MISSING: 'DRAW_CONFIG_MISSING',
} as const;

export type DrawConfigRefusalReason =
  (typeof DrawConfigRefusal)[keyof typeof DrawConfigRefusal];

const CONFIG_REFUSALS: readonly string[] = Object.values(DrawConfigRefusal);

export interface ConfigRefusal {
  reason: DrawConfigRefusalReason;
  occurredAt: Date;
}

/** The latest draw refusal of the raffle for its configuration, if any. */
export function latestConfigRefusal(events: AuditEvent[]): ConfigRefusal | null {
  let latest: ConfigRefusal | null = null;
  for (const event of events) {
    const reason = event.data.reason;
    if (
      event.type !== DRAW_REFUSED ||
      typeof reason !== 'string' ||
      !CONFIG_REFUSALS.includes(reason)
    ) {
      continue;
    }
    if (!latest || event.occurredAt.getTime() >= latest.occurredAt.getTime()) {
      latest = {
        reason: reason as DrawConfigRefusalReason,
        occurredAt: event.occurredAt,
      };
    }
  }
  return latest;
}
