/**
 * Fixed texts a buyer reads in a refund or review email, and on the refund.
 * An operator's free-text reason is internal: it stays on the raffle and in
 * the audit, never in a buyer email. The reason of a rejection is the
 * exception, because the buyer is meant to see it (DT-08, RF-08).
 */
export const RAFFLE_CANCELLED_BUYER_REASON = 'The raffle was cancelled';

export const EXTRA_TRANSFER_BUYER_REASON =
  'We received a transfer your order did not need';
