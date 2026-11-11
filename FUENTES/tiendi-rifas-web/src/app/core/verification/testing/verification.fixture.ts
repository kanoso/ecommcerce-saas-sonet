import vectors from '../../../../../../packages/raffle-draw/test/test-vectors.json';
import { VerificationData } from '../../api/api.models';
import { ROUND_1M } from '../../drand/drand.testing';
import { QUICKNET } from '../../drand/quicknet';

/** One case of @kanoso/raffle-draw's shared test vectors (F1). */
export interface DrawVector {
  name: string;
  seedHex: string;
  drandRandomnessHex: string;
  raffleId: string;
  soldNumbers: number[];
  expected: { commitmentHash: string; soldListHash: string; digestHex: string; index: number; winner: number };
}

export const DRAW_VECTORS = vectors as DrawVector[];

/** The verification data the API would send for a raffle drawn with a vector. */
export function verificationOf(vector: DrawVector, overrides: Partial<VerificationData> = {}): VerificationData {
  return {
    raffleId: vector.raffleId,
    title: 'Smart TV 55"',
    prize: 'Un televisor de 55 pulgadas',
    algorithmVersion: 'v1',
    authorizationResolution: 'RD-123-2026',
    status: 'DRAWN',
    commitmentHash: vector.expected.commitmentHash,
    seedRevealed: vector.seedHex,
    drandChainHash: QUICKNET.chainHash,
    drandRound: '1000000',
    // roundAt of this instant on quicknet is 1000000 (genesis + 999999 x 3 s).
    drawAt: new Date('2023-09-27T08:29:24.000Z'),
    // Half an hour before: its round, 999412, is earlier than 1000000.
    salesCloseAt: new Date('2023-09-27T08:00:00.000Z'),
    soldListHash: vector.expected.soldListHash,
    soldListVerified: true,
    soldNumbers: vector.soldNumbers,
    official: {
      drandRandomness: vector.drandRandomnessHex,
      winnerIndex: vector.expected.index,
      winningNumber: vector.expected.winner,
      digestHex: vector.expected.digestHex,
      executedAt: new Date('2026-11-16T01:30:03.000Z'),
    },
    ...overrides,
  };
}

/**
 * Vector 4 (real quicknet sample) drawn with the real round 1000000, whose
 * signature verifies. Expected values computed independently in a shell:
 *   (printf "$SEED$RANDOMNESS" | xxd -r -p; printf "$RAFFLE_ID") | sha256sum
 *   → cea25061…aa5b; mod 10 = 5; soldNumbers[5] = 60.
 */
export function verificationWithRealRound(overrides: Partial<VerificationData> = {}): VerificationData {
  const vector = DRAW_VECTORS[3];
  return verificationOf(vector, {
    official: {
      drandRandomness: ROUND_1M.randomness,
      winnerIndex: 5,
      winningNumber: 60,
      digestHex: 'cea2506136c11bbfd9343a5da20c07764b65d00ac0bd3d0d962c475fb4ddaa5b',
      executedAt: new Date('2026-11-16T01:30:03.000Z'),
    },
    ...overrides,
  });
}
