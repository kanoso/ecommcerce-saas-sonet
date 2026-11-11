import { BeaconRoundUnavailableError } from '../../application/ports';
import { DrandHttpBeacon, FetchLike, chainHashOf } from './drand-http-beacon';

/** quicknet, DT-01. */
const CHAIN_HASH =
  '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971';
const PUBLIC_KEY =
  '83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a';

/** Round 1000000 as api.drand.sh served it on 2026-11-02. */
const ROUND_1M = {
  round: 1000000,
  randomness:
    'b22aad4794f7451896f7a371aa46106fd84d919f3f569acd5b2fddf1d1440af3',
  signature:
    '83ad29e4c409f9470fc2ef02f90214df49e02b441a1a241a82d622d9f608ef98fd8b11a029f1bee9d9e83b45088abe72',
};

const RELAYS = ['https://relay-a.test', 'https://relay-b.test'];
const GROUP_HASH =
  'f477d5c89f21a17c863a7f937c6a6d15859414d2be09cd448d4279af331c5d3e';
const CHAIN = {
  chainHash: CHAIN_HASH,
  publicKeyHex: PUBLIC_KEY,
  genesisTimeSec: 1692803367,
  periodSec: 3,
  groupHashHex: GROUP_HASH,
  beaconId: 'quicknet',
};

type Answer = { status: number; body?: unknown } | Error;

function fakeFetch(answers: Record<string, Answer>): {
  fetch: FetchLike;
  calls: string[];
} {
  const calls: string[] = [];
  const fetch: FetchLike = async (url) => {
    calls.push(url);
    const answer = answers[url];
    if (!answer) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    if (answer instanceof Error) {
      throw answer;
    }
    return {
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      json: async () => answer.body,
    };
  };
  return { fetch, calls };
}

function beaconWith(fetch: FetchLike, relays = RELAYS): DrandHttpBeacon {
  return new DrandHttpBeacon({ ...CHAIN, relays, timeoutMs: 1000, fetch });
}

const url = (relay: string, round: string | number) =>
  `${relay}/${CHAIN_HASH}/public/${round}`;

describe('DrandHttpBeacon', () => {
  it('returns a round whose BLS signature verifies against the chain key', async () => {
    const { fetch } = fakeFetch({
      [url(RELAYS[0], 1000000)]: { status: 200, body: ROUND_1M },
    });

    const round = await beaconWith(fetch).getRound(1000000n);

    expect(round).toEqual({
      round: 1000000n,
      randomness: ROUND_1M.randomness,
      signature: ROUND_1M.signature,
    });
  });

  it('refuses a signature that belongs to another round and asks the next relay', async () => {
    const { fetch, calls } = fakeFetch({
      // A relay replaying round 1000000 as if it were 1000001.
      [url(RELAYS[0], 1000001)]: {
        status: 200,
        body: { ...ROUND_1M, round: 1000001 },
      },
    });

    await expect(beaconWith(fetch).getRound(1000001n)).rejects.toThrow(
      BeaconRoundUnavailableError,
    );
    expect(calls).toEqual([url(RELAYS[0], 1000001), url(RELAYS[1], 1000001)]);
  });

  it('refuses randomness that is not the hash of the signature', async () => {
    const { fetch } = fakeFetch({
      [url(RELAYS[0], 1000000)]: {
        status: 200,
        body: { ...ROUND_1M, randomness: 'ff'.repeat(32) },
      },
      [url(RELAYS[1], 1000000)]: { status: 200, body: ROUND_1M },
    });

    const round = await beaconWith(fetch).getRound(1000000n);

    // The forged answer is skipped; the honest relay is used.
    expect(round.randomness).toBe(ROUND_1M.randomness);
  });

  it('refuses an answer for a different round than asked', async () => {
    const { fetch } = fakeFetch({
      [url(RELAYS[0], 999999)]: { status: 200, body: ROUND_1M },
    });

    await expect(beaconWith(fetch, [RELAYS[0]]).getRound(999999n)).rejects.toThrow(
      BeaconRoundUnavailableError,
    );
  });

  it('falls back to the next relay when one is down', async () => {
    const { fetch, calls } = fakeFetch({
      [url(RELAYS[0], 1000000)]: new Error('ECONNREFUSED'),
      [url(RELAYS[1], 1000000)]: { status: 200, body: ROUND_1M },
    });

    const round = await beaconWith(fetch).getRound(1000000n);

    expect(round.round).toBe(1000000n);
    expect(calls).toHaveLength(2);
  });

  it('reports the round as unavailable while no relay has it, with each cause', async () => {
    const { fetch } = fakeFetch({
      [url(RELAYS[0], 1000000)]: { status: 425 },
      [url(RELAYS[1], 1000000)]: new Error('ETIMEDOUT'),
    });

    const failure = await beaconWith(fetch)
      .getRound(1000000n)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(BeaconRoundUnavailableError);
    expect((failure as BeaconRoundUnavailableError).causes).toEqual([
      'relay 1: HTTP 425',
      'relay 2: ETIMEDOUT',
    ]);
  });

  it('refuses a malformed answer', async () => {
    const { fetch } = fakeFetch({
      [url(RELAYS[0], 1000000)]: {
        status: 200,
        body: { round: 1000000, randomness: 'zz', signature: 'not-hex' },
      },
    });

    await expect(beaconWith(fetch, [RELAYS[0]]).getRound(1000000n)).rejects.toThrow(
      BeaconRoundUnavailableError,
    );
  });

  it('serves the round when any relay has it, whatever the others say', async () => {
    const { fetch } = fakeFetch({
      [url(RELAYS[0], 1000000)]: { status: 404 },
      [url(RELAYS[1], 1000000)]: { status: 200, body: ROUND_1M },
    });

    await expect(beaconWith(fetch).getRound(1000000n)).resolves.toMatchObject({
      round: 1000000n,
    });
  });

  it('has no way to ask for whatever round is newest', () => {
    const { fetch } = fakeFetch({});
    expect(
      (beaconWith(fetch) as unknown as Record<string, unknown>).getLatestRound,
    ).toBeUndefined();
  });

  it('gives the configured chain, not what a relay claims', async () => {
    const { fetch, calls } = fakeFetch({});

    await expect(beaconWith(fetch).getChainInfo()).resolves.toEqual({
      chainHash: CHAIN_HASH,
      genesisTimeSec: 1692803367,
      periodSec: 3,
    });
    expect(calls).toEqual([]);
  });

  it('takes no 404 for a reason to look at another round', async () => {
    const { fetch, calls } = fakeFetch({
      [url(RELAYS[0], 1000000)]: { status: 404 },
      [url(RELAYS[1], 1000000)]: { status: 404 },
    });

    await expect(beaconWith(fetch).getRound(1000000n)).rejects.toThrow(
      BeaconRoundUnavailableError,
    );
    expect(calls.every((call) => call.endsWith('/public/1000000'))).toBe(true);
  });

  it('refuses a relay that is not https', () => {
    const { fetch } = fakeFetch({});
    expect(() => beaconWith(fetch, ['http://relay-a.test'])).toThrow(
      'https',
    );
    expect(() => beaconWith(fetch, ['relay-a.test'])).toThrow('https');
  });

  it('asks each relay once, however it is written in the list', async () => {
    const { fetch, calls } = fakeFetch({});
    const beacon = beaconWith(fetch, [
      'https://relay-a.test',
      ' https://relay-a.test/ ',
      'https://RELAY-A.test',
      'https://relay-b.test',
      '',
    ]);

    await beacon.getRound(1000000n).catch(() => undefined);

    expect(calls).toEqual([url(RELAYS[0], 1000000), url(RELAYS[1], 1000000)]);
  });

  it('keeps the first entry of an origin listed twice', async () => {
    const { fetch, calls } = fakeFetch({});

    await beaconWith(fetch, [
      'https://relay-a.test/first',
      'https://relay-a.test/second',
    ])
      .getRound(1000000n)
      .catch(() => undefined);

    expect(calls).toEqual([
      `https://relay-a.test/first/${CHAIN_HASH}/public/1000000`,
    ]);
  });

  it('needs at least one relay and a valid key', () => {
    const { fetch } = fakeFetch({});
    expect(() => beaconWith(fetch, [])).toThrow('at least one drand relay');
    expect(() => beaconWith(fetch, [' ', ''])).toThrow('at least one drand relay');
    expect(
      () =>
        new DrandHttpBeacon({
          ...CHAIN,
          publicKeyHex: 'abcd',
          relays: RELAYS,
          timeoutMs: 1000,
          fetch,
        }),
    ).toThrow('drand public key');
  });

  it('computes the quicknet chain hash from its public parameters', () => {
    expect(chainHashOf(CHAIN)).toBe(CHAIN_HASH);
  });

  it('refuses at startup a chain hash that does not match its key', () => {
    const { fetch } = fakeFetch({});
    expect(
      () =>
        new DrandHttpBeacon({
          ...CHAIN,
          chainHash: 'ab'.repeat(32),
          relays: RELAYS,
          timeoutMs: 1000,
          fetch,
        }),
    ).toThrow('DRAND_CHAIN_HASH does not match');
    expect(
      () =>
        new DrandHttpBeacon({
          ...CHAIN,
          periodSec: 30,
          relays: RELAYS,
          timeoutMs: 1000,
          fetch,
        }),
    ).toThrow('DRAND_CHAIN_HASH does not match');
  });
});
