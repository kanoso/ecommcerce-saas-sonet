import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ALGORITHM_VERSION,
  generateSeed,
  commitmentHash,
  verifyCommitment,
  normalizeSoldNumbers,
  soldListHash,
  computeWinner,
  roundAt,
  timeOfRound,
} from '../src/index.js';

interface TestVector {
  name: string;
  seedHex: string;
  drandRandomnessHex: string;
  raffleId: string;
  soldNumbers: number[];
  expected: {
    commitmentHash: string;
    soldListHash: string;
    digestHex: string;
    index: number;
    winner: number;
  };
}

const testVectors: TestVector[] = JSON.parse(
  readFileSync(resolve(import.meta.dirname, 'test-vectors.json'), 'utf8'),
);

describe('raffle-draw (Specification §5.1, §5.2, §5.4)', () => {
  describe('Constants & Seed generation', () => {
    it('exports algorithm version v1', () => {
      expect(ALGORITHM_VERSION).toBe('v1');
    });

    it('generates a 32-byte CSPRNG seed formatted as 64 lowercase hex characters', () => {
      const seed1 = generateSeed();
      const seed2 = generateSeed();

      expect(seed1).toMatch(/^[0-9a-f]{64}$/);
      expect(seed2).toMatch(/^[0-9a-f]{64}$/);
      expect(seed1).not.toBe(seed2);
    });
  });

  describe('Commitment & Verification', () => {
    /**
     * Independent verification command:
     * node -e 'console.log(require("crypto").createHash("sha256").update(Buffer.alloc(32, 0xaa)).digest("hex"))'
     * Output: e0e77a507412b120f6ede61f62295b1a7b2ff19d3dcc8f7253e51663470c888e
     */
    it('matches SHA-256 calculated independently on raw seed bytes', async () => {
      const seedHex = 'aa'.repeat(32);
      const expectedSha256 = 'e0e77a507412b120f6ede61f62295b1a7b2ff19d3dcc8f7253e51663470c888e';

      const hash = await commitmentHash(seedHex);
      expect(hash).toBe(expectedSha256);
    });

    it('verifies valid commitment matching seed', async () => {
      const seed = generateSeed();
      const hash = await commitmentHash(seed);

      expect(await verifyCommitment(seed, hash)).toBe(true);
      expect(await verifyCommitment(seed, '0'.repeat(64))).toBe(false);
    });

    it('rejects invalid seed hex lengths or non-hex characters', async () => {
      await expect(commitmentHash('1234')).rejects.toThrow();
      await expect(commitmentHash('z'.repeat(64))).rejects.toThrow();
    });
  });

  describe('Sold Numbers Normalization & Hash', () => {
    it('normalizes numbers: sorts ascending, dedupes, and validates integers', () => {
      expect(normalizeSoldNumbers([5, 1, 5, 3])).toEqual([1, 3, 5]);
      expect(normalizeSoldNumbers([100, 20, 10, 50, 20])).toEqual([10, 20, 50, 100]);
    });

    it('rejects floats, negative values, and non-numeric inputs', () => {
      expect(() => normalizeSoldNumbers([1, 2.5, 3])).toThrow();
      expect(() => normalizeSoldNumbers([-1, 2, 3])).toThrow();
      expect(() => normalizeSoldNumbers([NaN])).toThrow();
      expect(() => normalizeSoldNumbers([Infinity])).toThrow();
      expect(() => normalizeSoldNumbers('not-array' as unknown as number[])).toThrow();
      expect(() => normalizeSoldNumbers(['invalid' as unknown as number])).toThrow();
    });

    it('computes soldListHash as hex(SHA-256(utf8(soldNumbers.join(","))))', async () => {
      // "1,3,5" in utf8 -> SHA-256: c45ddb5ff9af0a6a331c53c3b82006c04f624d3712e915ee628e58c05251d8be
      const hash = await soldListHash([1, 3, 5]);
      expect(hash).toBe('c45ddb5ff9af0a6a331c53c3b82006c04f624d3712e915ee628e58c05251d8be');
    });
  });

  describe('Winner computation', () => {
    it('throws error when soldNumbers array is empty or invalid', async () => {
      await expect(
        computeWinner({
          seedHex: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          drandRandomnessHex: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
          raffleId: '11111111-1111-4111-8111-111111111111',
          soldNumbers: [],
        }),
      ).rejects.toThrow();

      await expect(
        computeWinner({
          seedHex: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          drandRandomnessHex: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
          raffleId: '11111111-1111-4111-8111-111111111111',
          soldNumbers: 'invalid' as unknown as number[],
        }),
      ).rejects.toThrow();
    });

    it('rejects invalid hex in seed or drand randomness', async () => {
      await expect(
        computeWinner({
          seedHex: 'abc', // odd length
          drandRandomnessHex: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
          raffleId: '11111111-1111-4111-8111-111111111111',
          soldNumbers: [1, 2, 3],
        }),
      ).rejects.toThrow();

      await expect(
        computeWinner({
          seedHex: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          drandRandomnessHex: 'not-hex'.repeat(9),
          raffleId: '11111111-1111-4111-8111-111111111111',
          soldNumbers: [1, 2, 3],
        }),
      ).rejects.toThrow();
    });

    it('is deterministic and keeps index in [0, length)', async () => {
      const input = {
        seedHex: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        drandRandomnessHex: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
        raffleId: '11111111-1111-4111-8111-111111111111',
        soldNumbers: [10, 20, 30, 40, 50],
      };

      const res1 = await computeWinner(input);
      const res2 = await computeWinner(input);

      expect(res1).toEqual(res2);
      expect(res1.index).toBeGreaterThanOrEqual(0);
      expect(res1.index).toBeLessThan(input.soldNumbers.length);
      expect(res1.winner).toBe(input.soldNumbers[res1.index]);
    });
  });

  describe('5 Test Vectors (Exact match against test-vectors.json)', () => {
    test.each(testVectors)('$name', async (v) => {
      const commit = await commitmentHash(v.seedHex);
      expect(commit).toBe(v.expected.commitmentHash);

      const listHash = await soldListHash(v.soldNumbers);
      expect(listHash).toBe(v.expected.soldListHash);

      const outcome = await computeWinner({
        seedHex: v.seedHex,
        drandRandomnessHex: v.drandRandomnessHex,
        raffleId: v.raffleId,
        soldNumbers: v.soldNumbers,
      });

      expect(outcome.digestHex).toBe(v.expected.digestHex);
      expect(outcome.index).toBe(v.expected.index);
      expect(outcome.winner).toBe(v.expected.winner);
    });
  });

  describe('Distribution uniformity (10 000 seeds across 10 numbers)', () => {
    it('distributes winners with each index between 9% and 11%', async () => {
      const soldNumbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      const counts = new Array(10).fill(0);
      const drandRandomnessHex = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
      const raffleId = '00000000-0000-4000-8000-000000000000';
      const iterations = 10_000;

      for (let i = 0; i < iterations; i++) {
        const seedHex = generateSeed();
        const { index } = await computeWinner({
          seedHex,
          drandRandomnessHex,
          raffleId,
          soldNumbers,
        });
        counts[index]++;
      }

      for (let i = 0; i < 10; i++) {
        const percentage = (counts[i] / iterations) * 100;
        // Each index must fall between 9.0% and 11.0%
        expect(percentage).toBeGreaterThanOrEqual(9.0);
        expect(percentage).toBeLessThanOrEqual(11.0);
      }
    });
  });

  describe('Round and Time calculations (Quicknet chain)', () => {
    const quicknetChain = {
      genesisTimeSec: 1692803367,
      periodSec: 3,
    };

    it('calculates round 1 at genesis time exactly and handles timestamps before genesis', () => {
      const genesisMs = quicknetChain.genesisTimeSec * 1000;
      expect(roundAt(genesisMs, quicknetChain)).toBe(1);
      expect(roundAt(genesisMs - 10_000, quicknetChain)).toBe(1);
      expect(timeOfRound(1, quicknetChain)).toBe(genesisMs);
    });

    it('rejects invalid inputs to roundAt and timeOfRound', () => {
      expect(() => roundAt(NaN, quicknetChain)).toThrow();
      expect(() => roundAt(Infinity, quicknetChain)).toThrow();
      expect(() => timeOfRound(0, quicknetChain)).toThrow();
      expect(() => timeOfRound(-1, quicknetChain)).toThrow();
      expect(() => timeOfRound(1.5, quicknetChain)).toThrow();
      expect(() => timeOfRound('1' as unknown as number, quicknetChain)).toThrow();
    });

    it('roundAt and timeOfRound are exact inverses on round boundaries', () => {
      const roundsToTest = [1, 2, 100, 33500355];

      for (const r of roundsToTest) {
        const tMs = timeOfRound(r, quicknetChain);
        // Exact start of round
        expect(roundAt(tMs, quicknetChain)).toBe(r);
        // Just before the next round (periodSec * 1000 - 1 ms)
        expect(roundAt(tMs + 2999, quicknetChain)).toBe(r);
        // Start of next round
        expect(roundAt(tMs + 3000, quicknetChain)).toBe(r + 1);
      }
    });
  });
});
