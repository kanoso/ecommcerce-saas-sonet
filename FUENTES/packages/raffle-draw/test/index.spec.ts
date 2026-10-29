import { ALGORITHM_VERSION, getAlgorithmVersion } from '../src/index.js';

describe('raffle-draw package', () => {
  it('should export algorithm version v1', () => {
    expect(ALGORITHM_VERSION).toBe('v1');
    expect(getAlgorithmVersion()).toBe('v1');
  });
});
