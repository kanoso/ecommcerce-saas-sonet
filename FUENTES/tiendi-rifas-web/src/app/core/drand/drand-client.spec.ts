import { TestBed } from '@angular/core/testing';
import { DRAND_FETCH, DRAND_SETTINGS, DrandClient, DrandRoundUnavailableError } from './drand-client';
import { ROUND_1M, RelayAnswer, fakeDrand } from './drand.testing';
import { QUICKNET, quicknetChainHash } from './quicknet';

const RELAYS = ['https://relay-a.test', 'https://relay-b.test'];
const url = (relay: string, round: number | string) => `${relay}/${QUICKNET.chainHash}/public/${round}`;

function clientWith(answers: Record<string, RelayAnswer | RelayAnswer[]>, timeoutMs = 1000) {
  const drand = fakeDrand(answers);
  TestBed.configureTestingModule({
    providers: [
      { provide: DRAND_FETCH, useValue: drand.fetch },
      { provide: DRAND_SETTINGS, useValue: { relays: RELAYS, timeoutMs } },
    ],
  });
  return { client: TestBed.inject(DrandClient), calls: drand.calls };
}

async function failureOf(promise: Promise<unknown>): Promise<DrandRoundUnavailableError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof DrandRoundUnavailableError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected the round to be unavailable');
}

describe('quicknet', () => {
  it('pins a chain hash that matches its key, period, genesis, group hash and beacon id', async () => {
    expect(await quicknetChainHash()).toBe(QUICKNET.chainHash);
  });
});

describe('DrandClient', () => {
  it('asks the relay for the round by number and accepts it when its BLS signature verifies', async () => {
    const { client, calls } = clientWith({ [url(RELAYS[0], 1000000)]: { status: 200, body: ROUND_1M } });

    const round = await client.getRound('1000000');

    expect(round).toEqual({ round: '1000000', randomness: ROUND_1M.randomness, signature: ROUND_1M.signature });
    expect(calls).toEqual([url(RELAYS[0], 1000000)]);
  });

  it('moves on to the next relay when one is down', async () => {
    const { client, calls } = clientWith({
      [url(RELAYS[0], 1000000)]: 'network-error',
      [url(RELAYS[1], 1000000)]: { status: 200, body: ROUND_1M },
    });

    const round = await client.getRound('1000000');

    expect(round.randomness).toBe(ROUND_1M.randomness);
    expect(calls).toEqual([url(RELAYS[0], 1000000), url(RELAYS[1], 1000000)]);
  });

  it('gives up on a relay that does not answer in time', async () => {
    const { client } = clientWith(
      {
        [url(RELAYS[0], 1000000)]: 'hang',
        [url(RELAYS[1], 1000000)]: { status: 200, body: ROUND_1M },
      },
      20,
    );

    const round = await client.getRound('1000000');

    expect(round.round).toBe('1000000');
  });

  it('refuses a signature that does not verify for the round asked', async () => {
    // Round 1000000 replayed as 1000001: the randomness is still the hash of
    // the signature, only the BLS check can catch it.
    const replay = { ...ROUND_1M, round: 1000001 };
    const { client } = clientWith({
      [url(RELAYS[0], 1000001)]: { status: 200, body: replay },
      [url(RELAYS[1], 1000001)]: { status: 200, body: replay },
    });

    const error = await failureOf(client.getRound('1000001'));

    expect(error.causes).toEqual([
      { relay: 'relay-a.test', reason: 'bad-signature' },
      { relay: 'relay-b.test', reason: 'bad-signature' },
    ]);
    expect(error.notYetPublished).toBe(false);
  });

  it('refuses randomness that is not the hash of the signature', async () => {
    const { client } = clientWith({
      [url(RELAYS[0], 1000000)]: { status: 200, body: { ...ROUND_1M, randomness: 'ff'.repeat(32) } },
      [url(RELAYS[1], 1000000)]: { status: 200, body: ROUND_1M },
    });

    const round = await client.getRound('1000000');

    expect(round.randomness).toBe(ROUND_1M.randomness);
  });

  it('refuses an answer for another round or a malformed one', async () => {
    const { client } = clientWith({
      [url(RELAYS[0], 1000000)]: { status: 200, body: { ...ROUND_1M, round: 999999 } },
      [url(RELAYS[1], 1000000)]: { status: 200, body: { round: 1000000, randomness: 'zz', signature: 'x' } },
    });

    const error = await failureOf(client.getRound('1000000'));

    expect(error.causes).toEqual([
      { relay: 'relay-a.test', reason: 'wrong-round' },
      { relay: 'relay-b.test', reason: 'malformed' },
    ]);
  });

  it('reports every relay when none of them answers', async () => {
    const { client } = clientWith({
      [url(RELAYS[0], 1000000)]: 'network-error',
      [url(RELAYS[1], 1000000)]: { status: 503 },
    });

    const error = await failureOf(client.getRound('1000000'));

    expect(error.round).toBe('1000000');
    expect(error.notYetPublished).toBe(false);
    expect(error.causes).toEqual([
      { relay: 'relay-a.test', reason: 'network' },
      { relay: 'relay-b.test', reason: 'http', status: 503 },
    ]);
  });

  it('tells a round that is not published yet apart from relays that are down', async () => {
    const { client } = clientWith({
      [url(RELAYS[0], 99999999)]: { status: 425 },
      [url(RELAYS[1], 99999999)]: { status: 404 },
    });

    const error = await failureOf(client.getRound('99999999'));

    expect(error.notYetPublished).toBe(true);
  });

  it('never asks for a round that is not a positive whole number', async () => {
    const { client, calls } = clientWith({});

    await expect(client.getRound('latest')).rejects.toThrow();
    await expect(client.getRound('0')).rejects.toThrow();
    expect(calls).toEqual([]);
  });

  it('counts a round as not published when one relay says so, even if the others are down', async () => {
    const { client } = clientWith({
      [url(RELAYS[0], 1000000)]: 'network-error',
      [url(RELAYS[1], 1000000)]: { status: 425 },
    });

    const error = await failureOf(client.getRound('1000000'));

    expect(error.notYetPublished).toBe(true);
  });

  describe('cancellation', () => {
    afterEach(() => vi.useRealTimers());

    it('asks no relay when the signal is already aborted', async () => {
      const { client, calls } = clientWith({ [url(RELAYS[0], 1000000)]: { status: 200, body: ROUND_1M } });
      const controller = new AbortController();
      controller.abort();

      await expect(client.getRound('1000000', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
      expect(calls).toEqual([]);
    });

    it('stops at once when aborted mid-request: no next relay, no timer left', async () => {
      vi.useFakeTimers();
      const { client, calls } = clientWith({
        [url(RELAYS[0], 1000000)]: 'hang',
        [url(RELAYS[1], 1000000)]: { status: 200, body: ROUND_1M },
      });
      const controller = new AbortController();
      const pending = client.getRound('1000000', controller.signal);
      const settled = pending.catch((error: unknown) => error);

      controller.abort();

      expect(await settled).toMatchObject({ name: 'AbortError' });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(calls).toEqual([url(RELAYS[0], 1000000)]);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('pollRound', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('asks again while a relay says not yet, even with the other one down, and reports each attempt', async () => {
      const { client, calls } = clientWith({
        [url(RELAYS[0], 1000000)]: [{ status: 425 }, { status: 404 }, { status: 200, body: ROUND_1M }],
        [url(RELAYS[1], 1000000)]: 'network-error',
      });
      const progress: { attempt: number; relays: string[] }[] = [];

      const polled = client.pollRound('1000000', {
        intervalMs: 1000,
        maxWaitMs: 60_000,
        onProgress: (p) => progress.push({ attempt: p.attempt, relays: p.relays.map((r) => `${r.relay}:${r.reason}`) }),
      });
      await vi.advanceTimersByTimeAsync(2000);
      vi.useRealTimers();
      const round = await polled;

      expect(round.randomness).toBe(ROUND_1M.randomness);
      expect(calls).toHaveLength(5);
      expect(progress).toEqual([
        { attempt: 1, relays: ['relay-a.test:not-yet', 'relay-b.test:network'] },
        { attempt: 2, relays: ['relay-a.test:not-yet', 'relay-b.test:network'] },
      ]);
    });

    it('gives up after the total time, however long each pass takes', async () => {
      // Each pass waits 1 s for the hanging relay, then 1 s before the next one.
      const { client, calls } = clientWith(
        { [url(RELAYS[0], 1000000)]: { status: 425 }, [url(RELAYS[1], 1000000)]: 'hang' },
        1000,
      );

      const polled = client.pollRound('1000000', { intervalMs: 1000, maxWaitMs: 5000 }).catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(20_000);

      const error = (await polled) as DrandRoundUnavailableError;
      expect(error).toBeInstanceOf(DrandRoundUnavailableError);
      expect(error.notYetPublished).toBe(true);
      expect(calls.filter((c) => c.startsWith(RELAYS[0]))).toHaveLength(3);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('does not ask again when no relay says the round is missing', async () => {
      const { client, calls } = clientWith({
        [url(RELAYS[0], 1000000)]: 'network-error',
        [url(RELAYS[1], 1000000)]: { status: 503 },
      });

      const polled = client.pollRound('1000000', { intervalMs: 1000, maxWaitMs: 60_000 }).catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(10_000);

      expect(((await polled) as DrandRoundUnavailableError).notYetPublished).toBe(false);
      expect(calls).toHaveLength(2);
    });

    it('stops polling when aborted between attempts: no more requests, no timer left', async () => {
      const { client, calls } = clientWith({
        [url(RELAYS[0], 1000000)]: { status: 425 },
        [url(RELAYS[1], 1000000)]: { status: 425 },
      });
      const controller = new AbortController();
      const polled = client
        .pollRound('1000000', { intervalMs: 1000, maxWaitMs: 60_000, signal: controller.signal })
        .catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(1500);
      const asked = calls.length;

      controller.abort();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(await polled).toMatchObject({ name: 'AbortError' });
      expect(calls).toHaveLength(asked);
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
