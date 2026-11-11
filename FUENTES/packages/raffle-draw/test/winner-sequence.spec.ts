import {
  computeWinner,
  computeWinnerSequence,
  generateSeed,
} from '../src/index.js';

describe('computeWinnerSequence (Specification §1)', () => {
  const seedHex = 'aa'.repeat(32);
  const drandRandomnessHex = 'bb'.repeat(32);
  const raffleId = 'raffle-seq-test-123';

  it('throws an error if soldNumbers length is less than winningAttempt', async () => {
    await expect(
      computeWinnerSequence({
        seedHex,
        drandRandomnessHex,
        raffleId,
        soldNumbers: [10, 20],
        winningAttempt: 3,
      }),
    ).rejects.toThrow(/less than winningAttempt|Cannot compute/i);
  });

  it('throws an error if winningAttempt is out of range [1, 5] or not an integer', async () => {
    await expect(
      computeWinnerSequence({
        seedHex,
        drandRandomnessHex,
        raffleId,
        soldNumbers: [10, 20, 30],
        winningAttempt: 0,
      }),
    ).rejects.toThrow(/winningAttempt must be an integer between 1 and 5/i);

    await expect(
      computeWinnerSequence({
        seedHex,
        drandRandomnessHex,
        raffleId,
        soldNumbers: [10, 20, 30],
        winningAttempt: 6,
      }),
    ).rejects.toThrow(/winningAttempt must be an integer between 1 and 5/i);
  });

  it('for winningAttempt = 1, matches computeWinner output exactly (backward compatible)', async () => {
    const soldNumbers = [5, 12, 19, 42, 88];
    const single = await computeWinner({
      seedHex,
      drandRandomnessHex,
      raffleId,
      soldNumbers,
    });

    const seq = await computeWinnerSequence({
      seedHex,
      drandRandomnessHex,
      raffleId,
      soldNumbers,
      winningAttempt: 1,
    });

    expect(seq.winningAttempt).toBe(1);
    expect(seq.winningTicket).toBe(single.winner);
    expect(seq.winnerIndex).toBe(single.index);
    expect(seq.digestHex).toBe(single.digestHex);
    expect(seq.extractions).toHaveLength(1);
    expect(seq.extractions[0]).toEqual({
      attempt: 1,
      number: single.winner,
      index: single.index,
      digestHex: single.digestHex,
      isWinner: true,
    });
  });

  it('executes sequential sampling without replacement for 3 attempts', async () => {
    const soldNumbers = [100, 200, 300, 400, 500, 600];
    const seq = await computeWinnerSequence({
      seedHex,
      drandRandomnessHex,
      raffleId,
      soldNumbers,
      winningAttempt: 3,
    });

    expect(seq.winningAttempt).toBe(3);
    expect(seq.extractions).toHaveLength(3);

    // Attempts 1 and 2 are "Al agua"
    expect(seq.extractions[0].attempt).toBe(1);
    expect(seq.extractions[0].isWinner).toBe(false);

    expect(seq.extractions[1].attempt).toBe(2);
    expect(seq.extractions[1].isWinner).toBe(false);

    // Attempt 3 is the official winner
    expect(seq.extractions[2].attempt).toBe(3);
    expect(seq.extractions[2].isWinner).toBe(true);

    expect(seq.winningTicket).toBe(seq.extractions[2].number);
    expect(seq.winnerIndex).toBe(seq.extractions[2].index);
    expect(seq.digestHex).toBe(seq.extractions[2].digestHex);

    // Ensure all 3 extracted numbers are unique (sampled without replacement)
    const numbers = seq.extractions.map((e) => e.number);
    const unique = new Set(numbers);
    expect(unique.size).toBe(3);

    // Ensure all extracted numbers exist in soldNumbers and have correct original indices
    for (const extraction of seq.extractions) {
      expect(soldNumbers[extraction.index]).toBe(extraction.number);
    }
  });

  it('uses SHA-256 domain separator ":attempt:k" for k > 1', async () => {
    const soldNumbers = [1, 2, 3, 4, 5, 6, 7];
    const seq = await computeWinnerSequence({
      seedHex,
      drandRandomnessHex,
      raffleId,
      soldNumbers,
      winningAttempt: 3,
    });

    // Verification of digests: attempt 1 digest differs from attempt 2 and attempt 3
    expect(seq.extractions[0].digestHex).not.toBe(seq.extractions[1].digestHex);
    expect(seq.extractions[1].digestHex).not.toBe(seq.extractions[2].digestHex);

    // Attempt 1 digest must match single computeWinner digest
    const single = await computeWinner({
      seedHex,
      drandRandomnessHex,
      raffleId,
      soldNumbers,
    });
    expect(seq.extractions[0].digestHex).toBe(single.digestHex);
  });

  it('handles boundary condition where soldNumbers.length == winningAttempt', async () => {
    const soldNumbers = [7, 14, 21, 28, 35];
    const seq = await computeWinnerSequence({
      seedHex,
      drandRandomnessHex,
      raffleId,
      soldNumbers,
      winningAttempt: 5,
    });

    expect(seq.extractions).toHaveLength(5);
    const extractedNumbers = seq.extractions.map((e) => e.number);
    expect(new Set(extractedNumbers).size).toBe(5);
    expect(seq.extractions[4].isWinner).toBe(true);
    expect(seq.winningTicket).toBe(seq.extractions[4].number);
  });
});
