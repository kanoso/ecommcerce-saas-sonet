import {
  cellLabel,
  formatNumber,
  lostNotice,
  pageOfNumber,
  pageRanges,
  formatCents,
  lostNumbersOf,
  selectionSummary,
  selectionTotalCents,
  toCents,
  toggleNumber,
  unavailableAmong,
} from './raffle-grid.model';

describe('pageOfNumber', () => {
  it('finds the API page that holds a number', () => {
    expect(pageOfNumber(1, 1, 42)).toBe(1);
    expect(pageOfNumber(42, 1, 42)).toBe(1);
    expect(pageOfNumber(43, 1, 42)).toBe(2);
    expect(pageOfNumber(1000, 1, 42)).toBe(24);
  });

  it('counts from the first number of a range that does not start at one', () => {
    expect(pageOfNumber(0, 0, 42)).toBe(1);
    expect(pageOfNumber(42, 0, 42)).toBe(2);
  });

  it('counts from a first number above one', () => {
    expect(pageOfNumber(100, 100, 42)).toBe(1);
    expect(pageOfNumber(141, 100, 42)).toBe(1);
    expect(pageOfNumber(142, 100, 42)).toBe(2);
    expect(pageOfNumber(500, 100, 10)).toBe(41);
  });
});

describe('formatNumber', () => {
  it('pads to the width of the largest number', () => {
    expect(formatNumber(7, 999)).toBe('007');
    expect(formatNumber(7, 1000)).toBe('0007');
    expect(formatNumber(42, 50)).toBe('42');
  });
});

describe('pageRanges', () => {
  it('labels each page with its first and last number', () => {
    expect(pageRanges(1, 100, 42)).toEqual([
      { page: 1, first: 1, last: 42, label: '001–042' },
      { page: 2, first: 43, last: 84, label: '043–084' },
      { page: 3, first: 85, last: 100, label: '085–100' },
    ]);
  });

  it('has no pages for an empty or invalid range', () => {
    expect(pageRanges(10, 9, 42)).toEqual([]);
    expect(pageRanges(1, 10, 0)).toEqual([]);
  });
});

describe('toggleNumber', () => {
  it('adds a number, keeping the selection sorted', () => {
    expect(toggleNumber([7, 30], 23)).toEqual([7, 23, 30]);
  });

  it('removes a number already selected', () => {
    expect(toggleNumber([7, 23], 7)).toEqual([23]);
  });
});

describe('unavailableAmong', () => {
  it('lists the selected numbers that are known to be taken now', () => {
    const statuses = new Map([
      [7, 'AVAILABLE' as const],
      [23, 'RESERVED' as const],
      [30, 'SOLD' as const],
      [31, 'UNAVAILABLE' as const],
    ]);
    expect(unavailableAmong([7, 23, 30, 31, 99], statuses)).toEqual([23, 30, 31]);
  });
});

describe('toCents', () => {
  it('turns soles into whole cents once, rounding half up on the decimal value', () => {
    expect(toCents(10)).toBe(1000);
    expect(toCents(0.1)).toBe(10);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(1.005)).toBe(101);
    expect(toCents(0)).toBe(0);
  });
});

describe('selectionTotalCents', () => {
  it('multiplies whole cents, never fractional soles', () => {
    expect(selectionTotalCents(3, 10)).toBe(3000);
    expect(selectionTotalCents(3, 0.1)).toBe(30);
    expect(selectionTotalCents(3, 19.99)).toBe(5997);
    expect(selectionTotalCents(3, 1.005)).toBe(303);
    expect(selectionTotalCents(0, 10)).toBe(0);
  });
});

describe('formatCents', () => {
  it('shows whole cents as soles', () => {
    expect(formatCents(5997)).toMatch(/^S\/\s59\.97$/);
    expect(formatCents(30)).toMatch(/^S\/\s0\.30$/);
    expect(formatCents(303)).toMatch(/^S\/\s3\.03$/);
  });
});

describe('selectionSummary', () => {
  it('reads naturally for none, one and many', () => {
    expect(selectionSummary(0)).toBe('Ningún número elegido');
    expect(selectionSummary(1)).toBe('1 número elegido');
    expect(selectionSummary(5)).toBe('5 números elegidos');
  });
});

describe('cellLabel', () => {
  it('names the number and its state for screen readers', () => {
    expect(cellLabel(7, 'AVAILABLE', false, 999)).toBe('Número 007, disponible');
    expect(cellLabel(7, 'AVAILABLE', true, 999)).toBe('Número 007, elegido');
    expect(cellLabel(7, 'RESERVED', false, 999)).toBe('Número 007, reservado');
    expect(cellLabel(7, 'SOLD', false, 999)).toBe('Número 007, vendido');
    expect(cellLabel(7, 'UNAVAILABLE', false, 999)).toBe('Número 007, no disponible');
    expect(cellLabel(7, 'SOLD', false, 999, true)).toBe('Número 007, tu boleto (comprado)');
    expect(cellLabel(7, 'RESERVED', false, 999, true)).toBe('Número 007, tu boleto (reservado)');
  });
});

describe('lostNotice', () => {
  it('names one lost number', () => {
    expect(lostNotice([7], 999)).toBe('El número 007 ya no está disponible y lo quitamos de tu selección.');
  });

  it('names several lost numbers', () => {
    expect(lostNotice([7, 12, 23], 999)).toBe(
      'Los números 007, 012 y 023 ya no están disponibles y los quitamos de tu selección.',
    );
  });
});

describe('lostNumbersOf', () => {
  it('reads the requested numbers a 409 lists, sorted and unique', () => {
    expect(lostNumbersOf({ numeros_no_disponibles: [23, 7, 7] }, [7, 23, 30])).toEqual([7, 23]);
  });

  it('keeps only numbers the buyer asked for', () => {
    expect(lostNumbersOf({ numeros_no_disponibles: [7, 8] }, [7, 23])).toEqual([7]);
  });

  it.each([
    ['no details', undefined],
    ['details of another shape', [{ path: 'numeros', message: 'x' }]],
    ['a list that is not numbers', { numeros_no_disponibles: ['7'] }],
    ['an empty list', { numeros_no_disponibles: [] }],
    ['only numbers not asked for', { numeros_no_disponibles: [8] }],
  ])('is null with %s, so the caller falls back to reading the grid', (_, details) => {
    expect(lostNumbersOf(details, [7, 23])).toBeNull();
  });
});
