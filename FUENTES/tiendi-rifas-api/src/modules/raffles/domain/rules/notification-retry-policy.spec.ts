import { NotificationRetryPolicy } from './notification-retry-policy';

describe('NotificationRetryPolicy (DT-13)', () => {
  const now = new Date('2026-11-02T10:00:00Z');
  const at = (seconds: number) => new Date(now.getTime() + seconds * 1000);

  it('defaults to 11 attempts, a 5 min base, a 6 h cap, a 5 min lease, a 30 s send timeout and batches of 50', () => {
    const policy = new NotificationRetryPolicy();

    expect(policy.maxAttempts).toBe(11);
    expect(policy.batchSize).toBe(50);
    expect(policy.sendTimeoutMs).toBe(30_000);
    expect(policy.leaseEnd(now)).toEqual(at(300));
    expect(policy.nextAttemptAt(1, now)).toEqual(at(300));
  });

  it('keeps retrying for more than a day by default', () => {
    const policy = new NotificationRetryPolicy();

    // 300 + 600 + ... + 19 200, then three waits at the 6 h cap.
    expect(policy.retryWindowMs()).toBe(102_900_000);
    expect(policy.retryWindowMs()).toBeGreaterThanOrEqual(24 * 3_600_000);
  });

  it('adds up the waits between the first and the last attempt', () => {
    const policy = new NotificationRetryPolicy({
      maxAttempts: 3,
      baseDelaySeconds: 10,
    });

    expect(policy.retryWindowMs()).toBe(30_000);
  });

  it('doubles the wait after each failed attempt', () => {
    const policy = new NotificationRetryPolicy({ baseDelaySeconds: 10 });

    expect(policy.nextAttemptAt(1, now)).toEqual(at(10));
    expect(policy.nextAttemptAt(2, now)).toEqual(at(20));
    expect(policy.nextAttemptAt(3, now)).toEqual(at(40));
  });

  it('never waits longer than the cap', () => {
    const policy = new NotificationRetryPolicy({
      baseDelaySeconds: 60,
      maxDelaySeconds: 100,
    });

    expect(policy.nextAttemptAt(2, now)).toEqual(at(100));
    expect(policy.nextAttemptAt(60, now)).toEqual(at(100));
  });

  it('gives up once the attempts reach the maximum, not before', () => {
    const policy = new NotificationRetryPolicy({ maxAttempts: 3 });

    expect(policy.isExhausted(2)).toBe(false);
    expect(policy.isExhausted(3)).toBe(true);
    expect(policy.isExhausted(4)).toBe(true);
  });

  it('refuses settings that would never send or never retry', () => {
    expect(() => new NotificationRetryPolicy({ maxAttempts: 0 })).toThrow();
    expect(() => new NotificationRetryPolicy({ batchSize: 0 })).toThrow();
    expect(() => new NotificationRetryPolicy({ leaseSeconds: 0 })).toThrow();
    expect(
      () => new NotificationRetryPolicy({ baseDelaySeconds: -1 }),
    ).toThrow();
    expect(
      () =>
        new NotificationRetryPolicy({
          baseDelaySeconds: 10,
          maxDelaySeconds: 5,
        }),
    ).toThrow();
  });

  it('refuses a send timeout that is not positive', () => {
    expect(
      () => new NotificationRetryPolicy({ sendTimeoutSeconds: 0 }),
    ).toThrow();
  });

  it('refuses a lease that a send could outlast', () => {
    expect(
      () =>
        new NotificationRetryPolicy({
          leaseSeconds: 30,
          sendTimeoutSeconds: 30,
        }),
    ).toThrow('lease');
    expect(
      new NotificationRetryPolicy({ leaseSeconds: 31, sendTimeoutSeconds: 30 })
        .sendTimeoutMs,
    ).toBe(30_000);
  });
});
