import {
  ALGORITHM_VERSION,
  generateSeed,
  commitmentHash,
  verifyCommitment,
  computeWinner,
} from '@kanoso/raffle-draw';

describe('RaffleDraw in NestJS (tiendi-rifas-api import test)', () => {
  it('imports @kanoso/raffle-draw in Node without errors', async () => {
    expect(ALGORITHM_VERSION).toBe('v1');

    const seed = generateSeed();
    const hash = await commitmentHash(seed);
    const valid = await verifyCommitment(seed, hash);

    expect(valid).toBe(true);

    const winnerRes = await computeWinner({
      seedHex: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      drandRandomnessHex: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      raffleId: '11111111-1111-4111-8111-111111111111',
      soldNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    });

    expect(winnerRes.index).toBe(2);
    expect(winnerRes.winner).toBe(3);
  });
});
