import { formatCloseDate, formatCount, formatPrice, salesProgress } from './raffle-format';

describe('salesProgress', () => {
  it('returns the sold percentage rounded down', () => {
    expect(salesProgress(640, 1000)).toBe(64);
    expect(salesProgress(1, 3)).toBe(33);
  });

  it('never exceeds 100 nor goes below 0', () => {
    expect(salesProgress(1200, 1000)).toBe(100);
    expect(salesProgress(-5, 1000)).toBe(0);
  });

  it('is 0 for a raffle without numbers', () => {
    expect(salesProgress(0, 0)).toBe(0);
  });

  it('shows 1% rather than 0% once something is sold', () => {
    expect(salesProgress(1, 1000)).toBe(1);
  });
});

describe('formatPrice', () => {
  it('formats soles, keeping the symbol and amount together', () => {
    const nbsp = String.fromCharCode(160);
    expect(formatPrice(10)).toBe(`S/${nbsp}10.00`);
  });
});

describe('formatCloseDate', () => {
  // The machine runs in Tokyo (UTC+9): the text must still be Lima time (UTC-5).
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
  let previousTz: string | undefined;

  beforeAll(() => {
    previousTz = env?.['TZ'];
    if (env) env['TZ'] = 'Asia/Tokyo';
  });

  afterAll(() => {
    if (!env) return;
    if (previousTz === undefined) delete env['TZ'];
    else env['TZ'] = previousTz;
  });

  it('runs in a zone other than Lima', () => {
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Asia/Tokyo');
  });

  it('formats the close in Lima time with day, month and hour', () => {
    // 01:00 UTC on the 16th is 10:00 on the 16th in Tokyo, 20:00 on the 15th in Lima.
    expect(formatCloseDate(new Date('2026-11-16T01:00:00Z'))).toBe('15 nov., 20:00');
  });

  it('keeps the day of Lima across midnight UTC', () => {
    expect(formatCloseDate(new Date('2026-12-01T04:59:00Z'))).toBe('30 nov., 23:59');
  });

  it('returns null for an invalid date instead of throwing', () => {
    expect(formatCloseDate(new Date('not-a-date'))).toBeNull();
  });
});

describe('formatCount', () => {
  it('groups thousands as es-PE does', () => {
    expect(formatCount(1000)).toBe('1,000');
  });
});
