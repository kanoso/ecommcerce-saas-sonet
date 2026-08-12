import {
  toHistoryRow,
  toHistoryRows,
  toHistoryPage,
  formatFinishedAt,
  type DeliveryHistoryWire,
} from '../delivery-history';

/** Fixed clock so "hace 2 días" is a fact about the input, not about the test run. */
const NOW = new Date('2026-08-11T12:00:00.000Z');

function wire(overrides: Partial<DeliveryHistoryWire> = {}): DeliveryHistoryWire {
  return {
    id: 'delivery-1',
    status: 'DELIVERED',
    finishedAt: '2026-08-10T15:04:05.000Z',
    storeName: 'Bodega Central',
    customerName: 'Ana Torres',
    customerAddress: 'Jr. Lima 320, Miraflores',
    ...overrides,
  };
}

describe('toHistoryRow — status labels', () => {
  it('labels a completed delivery', () => {
    expect(toHistoryRow(wire({ status: 'DELIVERED' }), NOW).statusLabel).toBe('Entregada');
  });

  it('labels a cancelled delivery', () => {
    expect(toHistoryRow(wire({ status: 'CANCELLED' }), NOW).statusLabel).toBe('Cancelada');
  });

  it('gives a returned delivery its own label instead of collapsing it onto cancelled', () => {
    // `delivery.mapper.ts` maps RETURNED onto `Cancelado` and says outright that the
    // real fix belongs with whatever UI is built for that flow. This is that UI. The
    // two are not the same event: cancelled means it never left, returned means the
    // rider carried it back — and only one of those ends with goods in the rider's bag.
    expect(toHistoryRow(wire({ status: 'RETURNED' }), NOW).statusLabel).toBe('Devuelta');
  });

  it('labels a delivery that ended in an incident', () => {
    expect(toHistoryRow(wire({ status: 'INCIDENT' }), NOW).statusLabel).toBe(
      'Con incidente',
    );
  });

  it('falls back to a neutral label for a status this build has never heard of', () => {
    // A server deploy can add an enum member months before the store approves a build
    // that knows about it. An unlabelled row must still render as a row.
    const row = toHistoryRow(wire({ status: 'TELEPORTED' as never }), NOW);

    expect(row.statusLabel).toBe('Finalizada');
    expect(row.tone).toBe('neutral');
  });
});

describe('toHistoryRow — tone', () => {
  it('marks a completed delivery as a success', () => {
    expect(toHistoryRow(wire({ status: 'DELIVERED' }), NOW).tone).toBe('success');
  });

  it('marks a cancellation as a failure', () => {
    expect(toHistoryRow(wire({ status: 'CANCELLED' }), NOW).tone).toBe('danger');
  });

  it('marks returns and incidents as neither, because they are neither', () => {
    // A return is not the rider failing and not the delivery succeeding. Painting it
    // red reads as a black mark on the rider's own record for something that is
    // routinely the customer's decision.
    expect(toHistoryRow(wire({ status: 'RETURNED' }), NOW).tone).toBe('warning');
    expect(toHistoryRow(wire({ status: 'INCIDENT' }), NOW).tone).toBe('warning');
  });
});

describe('formatFinishedAt', () => {
  it('uses relative time for something that just happened', () => {
    // The commonest question this screen answers is "what did I do today", and
    // "hace 2 horas" answers it without the rider doing date arithmetic.
    expect(formatFinishedAt('2026-08-11T10:00:00.000Z', NOW)).toContain('hace');
  });

  it('switches to a calendar date once relative time stops being useful', () => {
    // "hace 5 meses" cannot locate the delivery a customer is disputing. Past a week
    // the rider needs a date they can match against a receipt.
    expect(formatFinishedAt('2026-03-02T09:30:00.000Z', NOW)).toBe('2 mar 2026');
  });

  it('keeps the year on an old delivery', () => {
    expect(formatFinishedAt('2025-12-24T18:00:00.000Z', NOW)).toBe('24 dic 2025');
  });

  it('reports a missing timestamp instead of rendering an empty gap', () => {
    expect(formatFinishedAt(null, NOW)).toBe('Sin fecha');
  });

  it('survives a timestamp the server should never have sent', () => {
    // The API resolves `finishedAt` from three nullable columns; a row whose timestamps
    // did not survive must cost one line of the list, not the screen.
    expect(formatFinishedAt('not-a-date', NOW)).toBe('Sin fecha');
  });
});

describe('toHistoryRow — text fields', () => {
  it('carries the store, customer and address through', () => {
    const row = toHistoryRow(wire(), NOW);

    expect(row).toMatchObject({
      id: 'delivery-1',
      storeName: 'Bodega Central',
      customerName: 'Ana Torres',
      customerAddress: 'Jr. Lima 320, Miraflores',
    });
  });

  it('substitutes a placeholder for an address the order never had', () => {
    // `Order.deliveryAddress` is a `Json?` column with nothing validating it on write,
    // so null reaches the client for real rows.
    expect(toHistoryRow(wire({ customerAddress: null }), NOW).customerAddress).toBe(
      'Sin dirección',
    );
  });

  it('substitutes a placeholder for an empty customer name', () => {
    expect(toHistoryRow(wire({ customerName: '' }), NOW).customerName).toBe('Sin nombre');
  });

  it('trims whitespace the API passed through unchanged', () => {
    expect(toHistoryRow(wire({ storeName: '  Bodega  ' }), NOW).storeName).toBe('Bodega');
  });
});

describe('toHistoryRows', () => {
  it('maps a page of rows', () => {
    const rows = toHistoryRows(
      [wire({ id: 'a' }), wire({ id: 'b', status: 'CANCELLED' })],
      NOW,
    );

    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(rows.map((r) => r.statusLabel)).toEqual(['Entregada', 'Cancelada']);
  });

  it('preserves server order rather than re-sorting', () => {
    // The API orders by `updatedAt` with an `id` tiebreaker precisely so pages line up.
    // Sorting again here on a different key would let page 2 overlap page 1.
    const rows = toHistoryRows(
      [
        wire({ id: 'older', finishedAt: '2026-01-01T00:00:00.000Z' }),
        wire({ id: 'newer', finishedAt: '2026-08-01T00:00:00.000Z' }),
      ],
      NOW,
    );

    expect(rows.map((r) => r.id)).toEqual(['older', 'newer']);
  });

  it('returns an empty list for a rider who has finished nothing', () => {
    expect(toHistoryRows([], NOW)).toEqual([]);
  });

  it('tolerates a malformed row without dropping the page', () => {
    const rows = toHistoryRows([wire(), {} as DeliveryHistoryWire], NOW);

    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      storeName: 'Sin tienda',
      customerName: 'Sin nombre',
      customerAddress: 'Sin dirección',
      statusLabel: 'Finalizada',
    });
  });
});

describe('toHistoryPage', () => {
  it('unwraps the envelope into rows plus the one paging fact the list needs', () => {
    const page = toHistoryPage(
      {
        items: [wire({ id: 'a' })],
        pagination: { page: 1, limit: 20, total: 45, totalPages: 3 },
      },
      NOW,
    );

    expect(page.rows.map((r) => r.id)).toEqual(['a']);
    expect(page.page).toBe(1);
    expect(page.hasMore).toBe(true);
  });

  it('stops the infinite list on the last page', () => {
    const page = toHistoryPage(
      {
        items: [wire()],
        pagination: { page: 3, limit: 20, total: 45, totalPages: 3 },
      },
      NOW,
    );

    expect(page.hasMore).toBe(false);
  });

  it('stops the infinite list for a rider who has finished nothing', () => {
    // `totalPages` is 0 here, so a naive `page < totalPages` would already be false —
    // but so would a naive `page <= totalPages`, and that one loops forever on page 1.
    const page = toHistoryPage(
      { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
      NOW,
    );

    expect(page.rows).toEqual([]);
    expect(page.hasMore).toBe(false);
  });

  it('stops rather than paging forever when the envelope is missing', () => {
    // A 200 with an unexpected body must not become an infinite `onEndReached` loop
    // hammering the API. Refusing to advance is the only safe default.
    const page = toHistoryPage(null, NOW);

    expect(page.rows).toEqual([]);
    expect(page.hasMore).toBe(false);
  });

  it('stops when the envelope arrives without its pagination block', () => {
    const page = toHistoryPage({ items: [wire()] }, NOW);

    expect(page.rows).toHaveLength(1);
    expect(page.hasMore).toBe(false);
  });

  it('survives items arriving as something other than a list', () => {
    const page = toHistoryPage(
      { items: 'nope', pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } },
      NOW,
    );

    expect(page.rows).toEqual([]);
  });
});
