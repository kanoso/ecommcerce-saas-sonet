import { TestBed } from '@angular/core/testing';
import { App } from './app';
import {
  ALGORITHM_VERSION,
  generateSeed,
  commitmentHash,
  verifyCommitment,
  computeWinner,
} from '@kanoso/raffle-draw';

describe('App & @kanoso/raffle-draw integration', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have initial title', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance.title).toBe('tiendi-rifas-web');
  });

  it('imports and computes verifiable winner in browser/Angular environment', async () => {
    expect(ALGORITHM_VERSION).toBe('v1');

    const seed = generateSeed();
    const hash = await commitmentHash(seed);
    expect(await verifyCommitment(seed, hash)).toBe(true);

    const result = await computeWinner({
      seedHex: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      drandRandomnessHex: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      raffleId: '11111111-1111-4111-8111-111111111111',
      soldNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    });

    expect(result.index).toBe(2);
    expect(result.winner).toBe(3);
  });
});

