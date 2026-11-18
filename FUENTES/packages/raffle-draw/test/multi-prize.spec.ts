import {
  ALGORITHM_VERSION,
  MAX_PRIZES,
  MULTI_PRIZE_ALGORITHM_VERSION,
  canonicalDrawConfig,
  computeMultiPrizeWinners,
  computeWinnerSequence,
  drawConfigHash,
  normalizeBuyerGroups,
  type ComputeMultiPrizeWinnersInput,
} from '../src/index.js';

const seedHex = 'aa'.repeat(32);
const drandRandomnessHex = 'bb'.repeat(32);
const raffleId = 'raffle-multi-prize-test';

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

function base(overrides: Partial<ComputeMultiPrizeWinnersInput> = {}): ComputeMultiPrizeWinnersInput {
  return {
    seedHex,
    drandRandomnessHex,
    raffleId,
    soldNumbers: range(1, 30),
    winningAttempt: 3,
    prizeCount: 3,
    exclusionMode: 'TICKET_ONLY',
    ...overrides,
  };
}

describe('computeMultiPrizeWinners (v2)', () => {
  it('declares its own algorithm version and leaves v1 untouched', () => {
    expect(ALGORITHM_VERSION).toBe('v1');
    expect(MULTI_PRIZE_ALGORITHM_VERSION).toBe('v2');
    expect(MAX_PRIZES).toBe(20);
  });

  it('is deterministic: the same inputs give the same full winners list', async () => {
    const a = await computeMultiPrizeWinners(base());
    const b = await computeMultiPrizeWinners(base());
    expect(a).toEqual(b);
    expect(a.algorithmVersion).toBe('v2');
    expect(a.prizes.map((p) => p.position)).toEqual([1, 2, 3]);
    expect(a.prizes.every((p) => p.status === 'WON')).toBe(true);
  });

  it('changes when the drand randomness changes', async () => {
    const a = await computeMultiPrizeWinners(base());
    const b = await computeMultiPrizeWinners(base({ drandRandomnessHex: 'cc'.repeat(32) }));
    expect(a.prizes.map((p) => p.extractions.map((e) => e.digestHex))).not.toEqual(
      b.prizes.map((p) => p.extractions.map((e) => e.digestHex)),
    );
  });

  it('derives each digest from seed || drand || raffleId || ":prize:<p>:attempt:<k>"', async () => {
    const result = await computeMultiPrizeWinners(base({ prizeCount: 2, winningAttempt: 2 }));
    const prefix = new Uint8Array([
      ...hexToBytes(seedHex),
      ...hexToBytes(drandRandomnessHex),
      ...new TextEncoder().encode(raffleId),
    ]);
    for (const prize of result.prizes) {
      for (const extraction of prize.extractions) {
        const suffix = new TextEncoder().encode(`:prize:${prize.position}:attempt:${extraction.attempt}`);
        const expected = await sha256Hex(new Uint8Array([...prefix, ...suffix]));
        expect(extraction.digestHex).toBe(expected);
      }
    }
  });

  it('draws attempts without replacement within a prize; the last attempt wins', async () => {
    const result = await computeMultiPrizeWinners(base({ winningAttempt: 4 }));
    for (const prize of result.prizes) {
      expect(prize.extractions).toHaveLength(4);
      expect(new Set(prize.extractions.map((e) => e.number)).size).toBe(4);
      expect(prize.extractions.map((e) => e.isWinner)).toEqual([false, false, false, true]);
      expect(prize.winningTicket).toBe(prize.extractions[3].number);
      expect(prize.digestHex).toBe(prize.extractions[3].digestHex);
    }
  });

  it('reports indexes against the normalized sold list', async () => {
    const soldNumbers = [50, 3, 3, 17, 8, 99, 41];
    const sorted = [3, 8, 17, 41, 50, 99];
    const result = await computeMultiPrizeWinners(base({ soldNumbers, prizeCount: 2, winningAttempt: 2 }));
    for (const prize of result.prizes) {
      for (const e of prize.extractions) {
        expect(sorted[e.index]).toBe(e.number);
      }
      expect(sorted[prize.winnerIndex as number]).toBe(prize.winningTicket);
    }
  });

  describe('TICKET_ONLY exclusion', () => {
    it('removes only the winning ticket from the next pool', async () => {
      const result = await computeMultiPrizeWinners(base({ prizeCount: 5 }));
      const winners = result.prizes.map((p) => p.winningTicket);
      expect(new Set(winners).size).toBe(5);
      expect(result.prizes.map((p) => p.poolSize)).toEqual([30, 29, 28, 27, 26]);
      for (const prize of result.prizes) {
        expect(prize.excludedTickets).toEqual([prize.winningTicket]);
      }
    });

    it('returns "al agua" tickets to the pool: they can win a later prize', async () => {
      let found = false;
      for (let i = 0; i < 300 && !found; i++) {
        const result = await computeMultiPrizeWinners(
          base({ raffleId: `al-agua-${i}`, soldNumbers: [1, 2, 3, 4], winningAttempt: 2, prizeCount: 2 }),
        );
        const losersOfFirst = result.prizes[0].extractions.filter((e) => !e.isWinner).map((e) => e.number);
        if (losersOfFirst.includes(result.prizes[1].winningTicket as number)) {
          found = true;
        }
      }
      expect(found).toBe(true);
    });

    it('never lets a winning ticket appear in a later prize', async () => {
      const result = await computeMultiPrizeWinners(base({ prizeCount: 8, soldNumbers: range(1, 12) }));
      const seen = new Set<number>();
      for (const prize of result.prizes) {
        for (const e of prize.extractions) {
          expect(seen.has(e.number)).toBe(false);
        }
        seen.add(prize.winningTicket as number);
      }
    });
  });

  describe('BUYER exclusion', () => {
    const buyerGroups = [
      [1, 2, 3, 4, 5],
      [6, 7],
      [8],
      [9, 10, 11, 12, 13, 14],
      [15, 16, 17],
      [18, 19, 20],
    ];

    it('removes every ticket of the winning buyer from the next pools', async () => {
      const result = await computeMultiPrizeWinners(
        base({
          soldNumbers: range(1, 20),
          winningAttempt: 2,
          prizeCount: 3,
          exclusionMode: 'BUYER',
          buyerGroups,
        }),
      );
      const removed = new Set<number>();
      let expectedPool = 20;
      for (const prize of result.prizes) {
        expect(prize.status).toBe('WON');
        expect(prize.poolSize).toBe(expectedPool);
        for (const e of prize.extractions) {
          expect(removed.has(e.number)).toBe(false);
        }
        const group = buyerGroups.find((g) => g.includes(prize.winningTicket as number)) as number[];
        expect(prize.excludedTickets).toEqual(group);
        group.forEach((n) => removed.add(n));
        expectedPool -= group.length;
      }
    });

    it('accepts groups in any order and with unsorted members', async () => {
      const shuffled = [[20, 18, 19], [8], [7, 6], [17, 15, 16], [14, 9, 10, 11, 12, 13], [5, 4, 3, 2, 1]];
      const a = await computeMultiPrizeWinners(
        base({ soldNumbers: range(1, 20), exclusionMode: 'BUYER', buyerGroups }),
      );
      const b = await computeMultiPrizeWinners(
        base({ soldNumbers: range(1, 20), exclusionMode: 'BUYER', buyerGroups: shuffled }),
      );
      expect(a).toEqual(b);
    });

    it('requires buyer groups that partition the sold list exactly', async () => {
      await expect(
        computeMultiPrizeWinners(base({ soldNumbers: range(1, 5), exclusionMode: 'BUYER' })),
      ).rejects.toThrow(/buyerGroups/);
      await expect(
        computeMultiPrizeWinners(
          base({ soldNumbers: range(1, 5), exclusionMode: 'BUYER', buyerGroups: [[1, 2], [3, 4]] }),
        ),
      ).rejects.toThrow(/buyerGroups/);
      await expect(
        computeMultiPrizeWinners(
          base({ soldNumbers: range(1, 5), exclusionMode: 'BUYER', buyerGroups: [[1, 2, 3], [3, 4, 5]] }),
        ),
      ).rejects.toThrow(/buyerGroups/);
      await expect(
        computeMultiPrizeWinners(
          base({ soldNumbers: range(1, 5), exclusionMode: 'BUYER', buyerGroups: [[1, 2, 3], [4, 5, 6]] }),
        ),
      ).rejects.toThrow(/buyerGroups/);
    });
  });

  describe('insufficient pool', () => {
    it('voids the prize and every later prize once the pool is smaller than winningAttempt', async () => {
      const result = await computeMultiPrizeWinners(
        base({ soldNumbers: range(1, 5), winningAttempt: 3, prizeCount: 5 }),
      );
      expect(result.prizes.map((p) => p.status)).toEqual(['WON', 'WON', 'WON', 'VOID', 'VOID']);
      expect(result.prizes.map((p) => p.poolSize)).toEqual([5, 4, 3, 2, 2]);
      for (const prize of result.prizes.slice(3)) {
        expect(prize.winningTicket).toBeNull();
        expect(prize.winnerIndex).toBeNull();
        expect(prize.digestHex).toBeNull();
        expect(prize.extractions).toEqual([]);
        expect(prize.excludedTickets).toEqual([]);
      }
    });

    it('voids prizes when a BUYER exclusion empties the pool', async () => {
      const result = await computeMultiPrizeWinners(
        base({
          soldNumbers: range(1, 6),
          winningAttempt: 1,
          prizeCount: 3,
          exclusionMode: 'BUYER',
          buyerGroups: [[1, 2, 3, 4, 5, 6]],
        }),
      );
      expect(result.prizes.map((p) => p.status)).toEqual(['WON', 'VOID', 'VOID']);
      expect(result.prizes[1].poolSize).toBe(0);
    });

    it('voids every prize when nothing was sold, without throwing', async () => {
      const result = await computeMultiPrizeWinners(base({ soldNumbers: [], prizeCount: 2 }));
      expect(result.prizes.map((p) => p.status)).toEqual(['VOID', 'VOID']);
    });

    it('voids every prize when the first pool is already too small', async () => {
      const result = await computeMultiPrizeWinners(
        base({ soldNumbers: [1, 2], winningAttempt: 3, prizeCount: 2 }),
      );
      expect(result.prizes.map((p) => p.status)).toEqual(['VOID', 'VOID']);
    });
  });

  describe('validation', () => {
    it('rejects a prize count outside 1..20', async () => {
      await expect(computeMultiPrizeWinners(base({ prizeCount: 0 }))).rejects.toThrow(/prizeCount/);
      await expect(computeMultiPrizeWinners(base({ prizeCount: 21 }))).rejects.toThrow(/prizeCount/);
      await expect(computeMultiPrizeWinners(base({ prizeCount: 1.5 }))).rejects.toThrow(/prizeCount/);
    });

    it('rejects a winningAttempt outside 1..5', async () => {
      await expect(computeMultiPrizeWinners(base({ winningAttempt: 0 }))).rejects.toThrow(/winningAttempt/);
      await expect(computeMultiPrizeWinners(base({ winningAttempt: 6 }))).rejects.toThrow(/winningAttempt/);
    });

    it('rejects an unknown exclusion mode', async () => {
      await expect(
        computeMultiPrizeWinners(base({ exclusionMode: 'EVERYONE' as never })),
      ).rejects.toThrow(/exclusionMode/);
    });
  });

  it('does not change v1 results', async () => {
    const v1 = await computeWinnerSequence({
      seedHex,
      drandRandomnessHex,
      raffleId: 'raffle-v1-snapshot',
      soldNumbers: range(1, 12),
      winningAttempt: 3,
    });
    expect(v1.winningTicket).toBe(9);
  });
});

describe('draw configuration commitment', () => {
  it('normalizes buyer groups: sorted members, groups ordered by their lowest ticket', () => {
    expect(normalizeBuyerGroups([[9, 4], [1], [7, 3, 5]])).toEqual([[1], [3, 5, 7], [4, 9]]);
  });

  it('rejects overlapping buyer groups', () => {
    expect(() => normalizeBuyerGroups([[1, 2], [2, 3]])).toThrow(/buyerGroups/);
  });

  it('has a documented canonical form', () => {
    expect(
      canonicalDrawConfig({
        exclusionMode: 'BUYER',
        winningAttempt: 2,
        prizeCount: 3,
        buyerGroups: [[4, 2], [1, 3]],
      }),
    ).toBe('tiendi-raffle-draw/v2;mode=BUYER;attempts=2;prizes=3;buyers=1,3|2,4');
    expect(
      canonicalDrawConfig({ exclusionMode: 'TICKET_ONLY', winningAttempt: 1, prizeCount: 1 }),
    ).toBe('tiendi-raffle-draw/v2;mode=TICKET_ONLY;attempts=1;prizes=1;buyers=');
  });

  it('ignores buyer groups in TICKET_ONLY mode', () => {
    expect(
      canonicalDrawConfig({
        exclusionMode: 'TICKET_ONLY',
        winningAttempt: 1,
        prizeCount: 1,
        buyerGroups: [[1, 2]],
      }),
    ).toBe('tiendi-raffle-draw/v2;mode=TICKET_ONLY;attempts=1;prizes=1;buyers=');
  });

  it('hashes the canonical form with SHA-256 and changes with the mode', async () => {
    const config = { exclusionMode: 'TICKET_ONLY' as const, winningAttempt: 2, prizeCount: 3 };
    const expected = await sha256Hex(new TextEncoder().encode(canonicalDrawConfig(config)));
    expect(await drawConfigHash(config)).toBe(expected);
    expect(
      await drawConfigHash({ ...config, exclusionMode: 'BUYER', buyerGroups: [[1], [2]] }),
    ).not.toBe(expected);
  });
});

/**
 * Golden vectors: computed independently (Node crypto, straight from the
 * written algorithm) and hard-coded. Any change to the v2 algorithm, its
 * payload layout or its exclusion rules breaks them, and with them every
 * published multi-prize verification.
 */
describe('v2 golden vectors', () => {
  const golden = {
    seedHex: '11'.repeat(32),
    drandRandomnessHex: '22'.repeat(32),
    raffleId: 'golden-v2-raffle',
    soldNumbers: [3, 7, 11, 15, 19, 23, 27, 31],
    winningAttempt: 2,
  };
  const buyerGroups = [[3, 7], [11], [15, 19, 23], [27, 31]];

  const D = {
    p1a1: 'bd5d1dbe829a61a340db791487c5eb66b662fb28ceb96ef305d16387b6466c28',
    p1a2: 'ec835f769463761a9adf1d4edf47c0ccf7586a0f8c016e882273fdd17bde437c',
    p2a1: 'e8622057599b5c6fbf8bae055894fe7edc27a7c0a2d3e3ee972654a55cd96192',
    p2a2: '354af4d4375987c3019cab01c66418bae98b766019266ec05570127a1433692e',
    p3a1: '655d5a7a3b7638011ae3d4a24b1609b0870900bbeb5d7fd0a1ab5bd9650c2cc9',
    p3a2: '255cf2b8af832fbd0fca1f6b883452807db14615f5f003031ae62168c888a70f',
    p4a1: '70b0f30274c929d8a399f0e69590e5f451dc72e509bdbaf5ccc2c37cef3e9162',
    p4a2: 'e3f97575a00d41b54ae5548cffe53714164834e7462e57a632564cdcf6cae0d3',
  };

  function won(
    position: number,
    poolSize: number,
    first: [number, number, string],
    last: [number, number, string],
    excludedTickets: number[],
  ) {
    return {
      position,
      status: 'WON',
      poolSize,
      winningTicket: last[0],
      winnerIndex: last[1],
      digestHex: last[2],
      extractions: [
        { attempt: 1, number: first[0], index: first[1], digestHex: first[2], isWinner: false },
        { attempt: 2, number: last[0], index: last[1], digestHex: last[2], isWinner: true },
      ],
      excludedTickets,
    };
  }

  it('BUYER, 5 prizes: exact winners, indexes, digests, exclusions and the VOID tail', async () => {
    const result = await computeMultiPrizeWinners({
      ...golden,
      prizeCount: 5,
      exclusionMode: 'BUYER',
      buyerGroups,
    });

    expect(result).toEqual({
      algorithmVersion: 'v2',
      exclusionMode: 'BUYER',
      winningAttempt: 2,
      prizes: [
        won(1, 8, [3, 0, D.p1a1], [19, 4, D.p1a2], [15, 19, 23]),
        won(2, 5, [11, 2, D.p2a1], [27, 6, D.p2a2], [27, 31]),
        won(3, 3, [7, 1, D.p3a1], [11, 2, D.p3a2], [11]),
        won(4, 2, [3, 0, D.p4a1], [7, 1, D.p4a2], [3, 7]),
        {
          position: 5,
          status: 'VOID',
          poolSize: 0,
          winningTicket: null,
          winnerIndex: null,
          digestHex: null,
          extractions: [],
          excludedTickets: [],
        },
      ],
    });
  });

  it('TICKET_ONLY, 3 prizes: same digests, different pools from prize 2 on', async () => {
    const result = await computeMultiPrizeWinners({
      ...golden,
      prizeCount: 3,
      exclusionMode: 'TICKET_ONLY',
    });

    expect(result.prizes).toEqual([
      won(1, 8, [3, 0, D.p1a1], [19, 4, D.p1a2], [19]),
      won(2, 7, [11, 2, D.p2a1], [15, 3, D.p2a2], [15]),
      won(3, 6, [7, 1, D.p3a1], [3, 0, D.p3a2], [3]),
    ]);
  });

  it('hashes the golden BUYER configuration to a fixed value', async () => {
    expect(
      await drawConfigHash({
        exclusionMode: 'BUYER',
        winningAttempt: 2,
        prizeCount: 3,
        buyerGroups,
      }),
    ).toBe('1ab2e9bb7f44e116ebaa35e05f5f1b793f8fa2a3b8b833370ebc04e6a0a526a7');
  });
});

describe('v2 boundaries', () => {
  it('lets the single ticket left win with winningAttempt = 1, then voids', async () => {
    const result = await computeMultiPrizeWinners(
      base({ soldNumbers: [5, 9], winningAttempt: 1, prizeCount: 3 }),
    );

    const [first, second, third] = result.prizes;
    expect(first.status).toBe('WON');
    expect(second).toMatchObject({ status: 'WON', poolSize: 1 });
    expect(second.extractions).toHaveLength(1);
    expect([first.winningTicket, second.winningTicket].sort()).toEqual([5, 9]);
    expect(second.winnerIndex).toBe(second.winningTicket === 5 ? 0 : 1);
    expect(third).toMatchObject({ status: 'VOID', poolSize: 0, winningTicket: null });
  });

  it('draws a prize when the pool is exactly winningAttempt, using every ticket once', async () => {
    const result = await computeMultiPrizeWinners(
      base({ soldNumbers: [1, 2, 3], winningAttempt: 3, prizeCount: 2 }),
    );

    const [first, second] = result.prizes;
    expect(first).toMatchObject({ status: 'WON', poolSize: 3 });
    expect(first.extractions.map((e) => e.number).sort()).toEqual([1, 2, 3]);
    expect(first.winningTicket).toBe(first.extractions[2].number);
    // One ticket left the pool: 2 < 3 attempts.
    expect(second).toMatchObject({ status: 'VOID', poolSize: 2 });
  });

  it('gives the identical result for shuffled and duplicated input', async () => {
    const ordered = await computeMultiPrizeWinners(
      base({
        soldNumbers: [1, 2, 3, 4, 5, 6],
        winningAttempt: 2,
        prizeCount: 3,
        exclusionMode: 'BUYER',
        buyerGroups: [[1, 2], [3], [4, 5, 6]],
      }),
    );
    const shuffled = await computeMultiPrizeWinners(
      base({
        soldNumbers: [6, 3, 1, 5, 3, 2, 4, 1],
        winningAttempt: 2,
        prizeCount: 3,
        exclusionMode: 'BUYER',
        buyerGroups: [[6, 4, 5, 4], [3], [2, 1, 2]],
      }),
    );

    expect(shuffled).toEqual(ordered);
  });
});
