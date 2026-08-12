import { format, formatDistanceStrict, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Terminal delivery states, exactly as `HISTORY_STATUSES` sends them.
 *
 * Deliberately narrower than the wire status union in `delivery.mapper.ts`: a delivery
 * that is still moving belongs to the active screen, and never reaches this list.
 */
export type HistoryWireStatus = 'DELIVERED' | 'CANCELLED' | 'RETURNED' | 'INCIDENT';

export type HistoryTone = 'success' | 'danger' | 'warning' | 'neutral';

/** One row of `GET /deliveries/me/history`, as `RiderDeliveryHistoryDto` serializes it. */
export interface DeliveryHistoryWire {
  id: string;
  status: HistoryWireStatus;
  finishedAt: string | null;
  storeName: string;
  customerName: string;
  customerAddress: string | null;
}

/** A row with every field already resolved to something a `<Text>` can render. */
export interface DeliveryHistoryRow {
  id: string;
  statusLabel: string;
  tone: HistoryTone;
  finishedAtLabel: string;
  storeName: string;
  customerName: string;
  customerAddress: string;
}

/**
 * `RETURNED` gets its own label rather than collapsing onto `Cancelada`.
 *
 * `delivery.mapper.ts` folds the two together for the active-delivery screen and says
 * in its own comment that the real fix belongs with whatever UI is built for the return
 * flow. This is that UI, and here the distinction is the whole point of the row: a
 * cancellation means the order never moved, a return means the rider carried it back.
 * Only one of those ends with someone holding goods that need reconciling.
 */
const STATUS_LABELS: Record<HistoryWireStatus, string> = {
  DELIVERED: 'Entregada',
  CANCELLED: 'Cancelada',
  RETURNED: 'Devuelta',
  INCIDENT: 'Con incidente',
};

/**
 * Returns and incidents are `warning`, not `danger`.
 *
 * This list is the rider's own record, and the rider reads colour before text. A return
 * is routinely the customer's decision and an incident is often the address being wrong;
 * painting either red reads as a black mark for something that was never theirs.
 */
const STATUS_TONES: Record<HistoryWireStatus, HistoryTone> = {
  DELIVERED: 'success',
  CANCELLED: 'danger',
  RETURNED: 'warning',
  INCIDENT: 'warning',
};

const UNKNOWN_LABEL = 'Finalizada';
const UNKNOWN_TONE: HistoryTone = 'neutral';

/**
 * Past this age a relative distance stops being an answer.
 *
 * Inside a week "hace 2 días" is what the rider actually wants — it answers "what did I
 * do today" with no arithmetic. Beyond it the phrasing degrades into "hace 5 meses",
 * which cannot locate the delivery a customer is disputing on the phone. Seven days is
 * where the useful question changes from *how recently* to *which day*.
 */
const RELATIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function textOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

/**
 * `finishedAt` as something renderable, or `'Sin fecha'`.
 *
 * `now` is a parameter rather than a `new Date()` inside so the output is a function of
 * the input alone — otherwise every assertion about "hace 2 horas" would be a statement
 * about when the suite happened to run.
 *
 * Note that `parseISO` does not throw on garbage; it returns an Invalid Date that
 * quietly poisons `format` further down. The guard has to be `isValid`, not try/catch.
 * The API resolves this field from three nullable columns, so a row arriving without a
 * usable timestamp is a real case, and it should cost one line of the list — never the
 * screen.
 */
export function formatFinishedAt(iso: string | null | undefined, now: Date): string {
  if (typeof iso !== 'string' || iso === '') return 'Sin fecha';

  const parsed = parseISO(iso);
  if (!isValid(parsed)) return 'Sin fecha';

  // Absolute difference, so a timestamp a few minutes into the future — a server clock
  // running slightly ahead of the handset — still reads as "en un momento" rather than
  // jumping to a calendar date that looks like a bug.
  if (Math.abs(now.getTime() - parsed.getTime()) < RELATIVE_WINDOW_MS) {
    return formatDistanceStrict(parsed, now, { addSuffix: true, locale: es });
  }

  return format(parsed, 'd MMM yyyy', { locale: es });
}

/**
 * One wire row to one render-ready row.
 *
 * Every field is defended because none of them are guaranteed: `customerAddress` comes
 * from a `Json?` column with nothing validating it on write, the customer name is built
 * by joining two nullable columns and can join to the empty string, and the status is an
 * enum the server can extend months before the store approves a build that knows the new
 * member. An unlabelled status still renders as a row — with a neutral tone, because
 * guessing that an unknown terminal state was a failure is worse than saying nothing.
 */
export function toHistoryRow(wire: DeliveryHistoryWire, now: Date): DeliveryHistoryRow {
  const status = wire?.status;
  const known = status != null && status in STATUS_LABELS;

  return {
    id: wire?.id,
    statusLabel: known ? STATUS_LABELS[status] : UNKNOWN_LABEL,
    tone: known ? STATUS_TONES[status] : UNKNOWN_TONE,
    finishedAtLabel: formatFinishedAt(wire?.finishedAt, now),
    storeName: textOr(wire?.storeName, 'Sin tienda'),
    customerName: textOr(wire?.customerName, 'Sin nombre'),
    customerAddress: textOr(wire?.customerAddress, 'Sin dirección'),
  };
}

/**
 * A page of wire rows, in the order the server sent them.
 *
 * Not re-sorted, and that is the point. The API orders by `updatedAt` with an `id`
 * tiebreaker so that page 2 begins exactly where page 1 ended; re-sorting here on any
 * other key would let rows overlap between pages or vanish between them.
 */
export function toHistoryRows(
  wires: readonly DeliveryHistoryWire[],
  now: Date,
): DeliveryHistoryRow[] {
  return (wires ?? []).map((wire) => toHistoryRow(wire, now));
}

/** One page of history, reduced to what an infinite list actually consumes. */
export interface DeliveryHistoryPage {
  rows: DeliveryHistoryRow[];
  page: number;
  hasMore: boolean;
}

/**
 * The `{ items, pagination }` envelope reduced to rows plus a single boolean.
 *
 * The screen never needs `total` or `limit` — it needs to know whether to ask for
 * another page. Collapsing four numbers into `hasMore` here keeps that arithmetic in
 * one tested place instead of inline in an `onEndReached` handler where it cannot be.
 *
 * Takes `unknown` because this is the boundary: the argument is whatever the network
 * handed back. A 200 carrying an unexpected body is the dangerous case — `onEndReached`
 * fires again the moment the list settles, so any failure mode that leaves `hasMore`
 * true turns one bad response into a request loop against the API. Every guard below
 * therefore fails toward `false`.
 */
export function toHistoryPage(payload: unknown, now: Date): DeliveryHistoryPage {
  const envelope = (payload ?? {}) as {
    items?: unknown;
    pagination?: { page?: unknown; totalPages?: unknown };
  };

  const rows = Array.isArray(envelope.items)
    ? toHistoryRows(envelope.items as DeliveryHistoryWire[], now)
    : [];

  const page = Number(envelope.pagination?.page);
  const totalPages = Number(envelope.pagination?.totalPages);

  // `Number(undefined)` is NaN and every comparison against NaN is false, so a missing
  // pagination block lands on `hasMore: false` without needing its own branch.
  return {
    rows,
    page: Number.isFinite(page) ? page : 1,
    hasMore: page < totalPages,
  };
}
