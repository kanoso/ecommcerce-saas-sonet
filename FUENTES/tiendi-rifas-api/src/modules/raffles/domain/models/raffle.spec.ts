import { RaffleStatus } from '../enums/raffle-status.enum';
import {
  InvalidRaffleTransitionError,
  RaffleValidationError,
  SoldListIntactError,
} from '../errors/domain.errors';
import { Raffle } from './raffle';

describe('Raffle Domain Entity', () => {
  const createDraftRaffle = (overrides?: Partial<ConstructorParameters<typeof Raffle>[0]>) => {
    return new Raffle({
      id: 'raffle-123',
      title: 'Mega Sorteo Auto 0km',
      prize: 'Toyota Yaris 2026',
      ticketPrice: 25.0,
      numberMin: 1,
      numberMax: 1000,
      createdAt: new Date('2026-11-01T10:00:00Z'),
      ...overrides,
    });
  };

  it('initializes in DRAFT status by default', () => {
    const raffle = createDraftRaffle();
    expect(raffle.status).toBe(RaffleStatus.DRAFT);
    expect(raffle.commitmentHash).toBeNull();
    expect(raffle.seedRevealed).toBeNull();
    expect(raffle.soldListHash).toBeNull();
  });

  it('rejects invalid number ranges and non-positive ticket prices', () => {
    expect(() => createDraftRaffle({ numberMin: -1 })).toThrow(RaffleValidationError);
    expect(() => createDraftRaffle({ numberMin: 10, numberMax: 5 })).toThrow(RaffleValidationError);
    expect(() => createDraftRaffle({ ticketPrice: 0 })).toThrow(RaffleValidationError);
    expect(() => createDraftRaffle({ ticketPrice: -5 })).toThrow(RaffleValidationError);
  });

  describe('publish', () => {
    const validPublishParams = {
      authorizationResolution: 'RESOLUCION-MINJUS-2026-999',
      commitmentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      seedCiphertext: 'encrypted-seed-data',
      drandRound: 1000000n,
      drandChainHash: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
      salesCloseAt: new Date('2026-11-10T18:00:00Z'),
      drawAt: new Date('2026-11-10T19:00:00Z'),
      currentRoundAtSalesClose: 999000n,
    };

    it('successfully publishes a DRAFT raffle with valid legal and cryptographic parameters', () => {
      const raffle = createDraftRaffle();
      raffle.publish(validPublishParams);

      expect(raffle.status).toBe(RaffleStatus.ACTIVE);
      expect(raffle.authorizationResolution).toBe('RESOLUCION-MINJUS-2026-999');
      expect(raffle.commitmentHash).toBe(validPublishParams.commitmentHash);
      expect(raffle.seedCiphertext).toBe('encrypted-seed-data');
      expect(raffle.drandRound).toBe(1000000n);
      expect(raffle.drandChainHash).toBe(validPublishParams.drandChainHash);
      expect(raffle.salesCloseAt).toEqual(validPublishParams.salesCloseAt);
      expect(raffle.drawAt).toEqual(validPublishParams.drawAt);
    });

    it('rejects publishing without legal authorization resolution', () => {
      const raffle = createDraftRaffle();
      expect(() => {
        raffle.publish({
          ...validPublishParams,
          authorizationResolution: '   ',
        });
      }).toThrow(RaffleValidationError);
    });

    it('rejects publishing when salesCloseAt is equal to or later than drawAt', () => {
      const raffle = createDraftRaffle();
      expect(() => {
        raffle.publish({
          ...validPublishParams,
          salesCloseAt: new Date('2026-11-10T19:00:00Z'),
          drawAt: new Date('2026-11-10T19:00:00Z'),
        });
      }).toThrow(RaffleValidationError);
    });

    it('rejects publishing when drandRound is not strictly after salesClose round', () => {
      const raffle = createDraftRaffle();
      expect(() => {
        raffle.publish({
          ...validPublishParams,
          drandRound: 999000n,
          currentRoundAtSalesClose: 999000n,
        });
      }).toThrow(RaffleValidationError);
    });

    it('rejects publishing if raffle is not in DRAFT', () => {
      const raffle = createDraftRaffle();
      raffle.publish(validPublishParams);
      expect(() => {
        raffle.publish(validPublishParams);
      }).toThrow(InvalidRaffleTransitionError);
    });
  });

  describe('closeSales', () => {
    it('transitions from ACTIVE to CLOSED and stores frozen sold list hash and revealed seed', () => {
      const raffle = createDraftRaffle();
      raffle.publish({
        authorizationResolution: 'RESOLUCION-MINJUS-2026-999',
        commitmentHash: 'commit123',
        seedCiphertext: 'cipher123',
        drandRound: 1000n,
        drandChainHash: 'chain123',
        salesCloseAt: new Date('2026-11-10T18:00:00Z'),
        drawAt: new Date('2026-11-10T19:00:00Z'),
        currentRoundAtSalesClose: 900n,
      });

      raffle.closeSales('hash-of-sold-1-2-3', 'revealed-seed-hex');

      expect(raffle.status).toBe(RaffleStatus.CLOSED);
      expect(raffle.soldListHash).toBe('hash-of-sold-1-2-3');
      expect(raffle.seedRevealed).toBe('revealed-seed-hex');
    });

    it('rejects closing sales if raffle is not ACTIVE', () => {
      const raffle = createDraftRaffle();
      expect(() => {
        raffle.closeSales('hash123', 'seed123');
      }).toThrow(InvalidRaffleTransitionError);
    });
  });

  describe('markDrawn', () => {
    it('transitions from CLOSED to DRAWN', () => {
      const raffle = createDraftRaffle();
      raffle.publish({
        authorizationResolution: 'RES-1',
        commitmentHash: 'commit123',
        seedCiphertext: 'cipher123',
        drandRound: 1000n,
        drandChainHash: 'chain123',
        salesCloseAt: new Date('2026-11-10T18:00:00Z'),
        drawAt: new Date('2026-11-10T19:00:00Z'),
        currentRoundAtSalesClose: 900n,
      });
      raffle.closeSales('hash123', 'seed123');
      raffle.markDrawn();

      expect(raffle.status).toBe(RaffleStatus.DRAWN);
    });

    it('rejects marking drawn if raffle is not CLOSED', () => {
      const raffle = createDraftRaffle();
      expect(() => {
        raffle.markDrawn();
      }).toThrow(InvalidRaffleTransitionError);
    });
  });

  describe('cancel', () => {
    it('cancels a DRAFT raffle', () => {
      const raffle = createDraftRaffle();
      raffle.cancel('Administrative cancellation');
      expect(raffle.status).toBe(RaffleStatus.CANCELLED);
    });

    it('cancels an ACTIVE raffle', () => {
      const raffle = createDraftRaffle();
      raffle.publish({
        authorizationResolution: 'RES-1',
        commitmentHash: 'commit123',
        seedCiphertext: 'cipher123',
        drandRound: 1000n,
        drandChainHash: 'chain123',
        salesCloseAt: new Date('2026-11-10T18:00:00Z'),
        drawAt: new Date('2026-11-10T19:00:00Z'),
        currentRoundAtSalesClose: 900n,
      });
      raffle.cancel('Force majeure');
      expect(raffle.status).toBe(RaffleStatus.CANCELLED);
    });

    it('rejects cancellation of CLOSED or DRAWN raffles', () => {
      const raffle = createDraftRaffle();
      raffle.publish({
        authorizationResolution: 'RES-1',
        commitmentHash: 'commit123',
        seedCiphertext: 'cipher123',
        drandRound: 1000n,
        drandChainHash: 'chain123',
        salesCloseAt: new Date('2026-11-10T18:00:00Z'),
        drawAt: new Date('2026-11-10T19:00:00Z'),
        currentRoundAtSalesClose: 900n,
      });
      raffle.closeSales('hash123', 'seed123');
      expect(() => raffle.cancel()).toThrow(InvalidRaffleTransitionError);

      raffle.markDrawn();
      expect(() => raffle.cancel()).toThrow(InvalidRaffleTransitionError);
    });
  });

  describe('cancelForAlteredList (DT-15)', () => {
    const closedRaffle = () => {
      const raffle = createDraftRaffle();
      raffle.publish({
        authorizationResolution: 'RES-1',
        commitmentHash: 'commit123',
        seedCiphertext: 'cipher123',
        drandRound: 1000n,
        drandChainHash: 'chain123',
        salesCloseAt: new Date('2026-11-10T18:00:00Z'),
        drawAt: new Date('2026-11-10T19:00:00Z'),
        currentRoundAtSalesClose: 900n,
      });
      raffle.closeSales('frozen-hash', 'seed123');
      return raffle;
    };

    it('cancels a CLOSED raffle whose sold list no longer matches', () => {
      const raffle = closedRaffle();

      raffle.cancelForAlteredList('other-hash', 'List altered after close');

      expect(raffle.status).toBe(RaffleStatus.CANCELLED);
      expect(raffle.cancellationReason).toBe('List altered after close');
    });

    it('refuses a CLOSED raffle whose sold list is intact', () => {
      const raffle = closedRaffle();

      expect(() =>
        raffle.cancelForAlteredList('frozen-hash', 'No reason to cancel'),
      ).toThrow(SoldListIntactError);
      expect(raffle.status).toBe(RaffleStatus.CLOSED);
      expect(raffle.cancellationReason).toBeNull();
    });

    it('refuses a raffle that is not CLOSED', () => {
      const active = createDraftRaffle();
      expect(() => active.cancelForAlteredList('other-hash', 'Reason')).toThrow(
        InvalidRaffleTransitionError,
      );

      const drawn = closedRaffle();
      drawn.markDrawn();
      expect(() => drawn.cancelForAlteredList('other-hash', 'Reason')).toThrow(
        InvalidRaffleTransitionError,
      );
      expect(drawn.status).toBe(RaffleStatus.DRAWN);
    });
  });
});
