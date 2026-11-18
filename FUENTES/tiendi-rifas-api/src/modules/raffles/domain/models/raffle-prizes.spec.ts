import { RaffleStatus, WinnerExclusionMode } from '../enums/raffle-status.enum';
import {
  InvalidRaffleTransitionError,
  RaffleValidationError,
  SalesClosedError,
} from '../errors/domain.errors';
import { Raffle, RaffleProps } from './raffle';
import { MAX_RAFFLE_PRIZES } from './raffle-prize';

const publishParams = {
  authorizationResolution: 'RD-001',
  commitmentHash: 'c'.repeat(64),
  seedCiphertext: 'cipher',
  drandRound: 1000n,
  drandChainHash: 'h'.repeat(64),
  salesCloseAt: new Date('2026-11-10T18:00:00Z'),
  drawAt: new Date('2026-11-10T19:00:00Z'),
  currentRoundAtSalesClose: 900n,
};

function raffle(overrides: Partial<RaffleProps> = {}): Raffle {
  return new Raffle({
    id: 'r-1',
    title: 'Rifa',
    prize: 'Auto',
    ticketPrice: 10,
    numberMin: 1,
    numberMax: 100,
    ...overrides,
  });
}

const prize = (id: string, title: string) => ({ id, title });

/** One second before the close of sales of publishParams. */
const beforeClose = new Date('2026-11-10T17:59:59Z');

describe('Raffle prizes', () => {
  it('derives a single prize at position 1 from the legacy prize fields', () => {
    const r = raffle({ prizeDescription: 'Rojo', prizeImages: ['https://x/a.png'] });
    expect(r.prizes).toEqual([
      {
        id: 'r-1:prize:1',
        position: 1,
        title: 'Auto',
        description: 'Rojo',
        images: ['https://x/a.png'],
      },
    ]);
  });

  it('keeps the given prizes ordered by position and mirrors prize 1 in the legacy getters', () => {
    const r = raffle({
      prize: undefined,
      prizes: [
        { id: 'p2', position: 2, title: 'Moto', description: null, images: [] },
        { id: 'p1', position: 1, title: 'Auto', description: 'Rojo', images: ['https://x/a.png'] },
      ],
    });
    expect(r.prizes.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(r.prize).toBe('Auto');
    expect(r.prizeDescription).toBe('Rojo');
    expect(r.prizeImages).toEqual(['https://x/a.png']);
  });

  it('requires at least one prize and at most 20', () => {
    expect(() => raffle({ prize: undefined, prizes: [] })).toThrow(RaffleValidationError);
    const many = Array.from({ length: MAX_RAFFLE_PRIZES + 1 }, (_, i) => ({
      id: `p${i}`,
      position: i + 1,
      title: `Premio ${i + 1}`,
      description: null,
      images: [],
    }));
    expect(() => raffle({ prizes: many })).toThrow(RaffleValidationError);
    expect(MAX_RAFFLE_PRIZES).toBe(20);
  });

  it('rejects positions that are not 1..N without gaps', () => {
    expect(() =>
      raffle({
        prizes: [
          { id: 'p1', position: 1, title: 'A', description: null, images: [] },
          { id: 'p3', position: 3, title: 'B', description: null, images: [] },
        ],
      }),
    ).toThrow(RaffleValidationError);
  });

  it('rejects an empty title and more than 10 images per prize', () => {
    expect(() => raffle({ prizes: [{ id: 'p', position: 1, title: ' ', description: null, images: [] }] })).toThrow(
      RaffleValidationError,
    );
    const images = Array.from({ length: 11 }, (_, i) => `https://x/${i}.png`);
    expect(() => raffle({ prizes: [{ id: 'p', position: 1, title: 'A', description: null, images }] })).toThrow(
      RaffleValidationError,
    );
  });

  describe('updateDraft', () => {
    it('replaces the ordered prize list, positions following the given order', () => {
      const r = raffle();
      r.updateDraft({
        prizes: [prize('a', ' Moto '), { id: 'b', title: 'Auto', description: 'Rojo', images: ['https://x/b.png'] }],
      });
      expect(r.prizes).toEqual([
        { id: 'a', position: 1, title: 'Moto', description: null, images: [] },
        { id: 'b', position: 2, title: 'Auto', description: 'Rojo', images: ['https://x/b.png'] },
      ]);
      expect(r.prize).toBe('Moto');
    });

    it('rejects mixing the prize list with the legacy prize fields', () => {
      const r = raffle();
      expect(() => r.updateDraft({ prizes: [prize('a', 'Moto')], prize: 'Auto' })).toThrow(RaffleValidationError);
    });

    it('applies the legacy prize fields to prize 1 only', () => {
      const r = raffle();
      r.updateDraft({ prizes: [prize('a', 'Moto'), prize('b', 'Auto')] });
      r.updateDraft({ prize: 'Bicicleta', prizeDescription: 'Montañera' });
      expect(r.prizes.map((p) => p.title)).toEqual(['Bicicleta', 'Auto']);
      expect(r.prizes[0].description).toBe('Montañera');
    });

    it('cannot change prizes once published', () => {
      const r = raffle();
      r.publish(publishParams);
      expect(() => r.updateDraft({ prizes: [prize('a', 'Moto')] })).toThrow(InvalidRaffleTransitionError);
    });
  });
});

describe('Raffle winner exclusion mode', () => {
  it('defaults to TICKET_ONLY', () => {
    expect(raffle().winnerExclusionMode).toBe(WinnerExclusionMode.TICKET_ONLY);
  });

  it('can be set at creation and in DRAFT', () => {
    const r = raffle({ winnerExclusionMode: WinnerExclusionMode.BUYER });
    expect(r.winnerExclusionMode).toBe(WinnerExclusionMode.BUYER);
    r.updateDraft({ winnerExclusionMode: WinnerExclusionMode.TICKET_ONLY });
    expect(r.winnerExclusionMode).toBe(WinnerExclusionMode.TICKET_ONLY);
  });

  it('can change while ACTIVE and reports the previous mode', () => {
    const r = raffle();
    r.publish(publishParams);
    const previous = r.changeWinnerExclusionMode(WinnerExclusionMode.BUYER, beforeClose);
    expect(previous).toBe(WinnerExclusionMode.TICKET_ONLY);
    expect(r.winnerExclusionMode).toBe(WinnerExclusionMode.BUYER);
  });

  it.each([RaffleStatus.CLOSED, RaffleStatus.DRAWN, RaffleStatus.CANCELLED])(
    'is locked once the raffle is %s',
    (status) => {
      const r = raffle({ status });
      expect(() =>
        r.changeWinnerExclusionMode(WinnerExclusionMode.BUYER, beforeClose),
      ).toThrow(InvalidRaffleTransitionError);
      expect(r.winnerExclusionMode).toBe(WinnerExclusionMode.TICKET_ONLY);
    },
  );

  it.each([
    ['at', new Date('2026-11-10T18:00:00Z')],
    ['after', new Date('2026-11-10T18:00:01Z')],
  ])(
    'is locked %s salesCloseAt while still ACTIVE (the close job has not run yet)',
    (_when, now) => {
      const r = raffle();
      r.publish(publishParams);
      expect(() => r.changeWinnerExclusionMode(WinnerExclusionMode.BUYER, now)).toThrow(
        SalesClosedError,
      );
      expect(r.winnerExclusionMode).toBe(WinnerExclusionMode.TICKET_ONLY);
    },
  );

  it('rejects an unknown mode', () => {
    const r = raffle();
    expect(() =>
      r.changeWinnerExclusionMode('EVERYONE' as WinnerExclusionMode, beforeClose),
    ).toThrow(
      RaffleValidationError,
    );
  });
});

describe('Raffle draw configuration freeze', () => {
  it('stores the draw configuration hash when sales close', () => {
    const r = raffle();
    r.publish(publishParams);
    const frozenAt = new Date('2026-11-10T18:00:05Z');
    r.closeSales('list-hash', 'seed', 'config-hash', frozenAt);
    expect(r.drawConfigHash).toBe('config-hash');
    expect(r.drawConfigFrozenAt).toEqual(frozenAt);
  });

  it('keeps legacy closes without a configuration hash', () => {
    const r = raffle();
    r.publish(publishParams);
    r.closeSales('list-hash', 'seed');
    expect(r.drawConfigHash).toBeNull();
    expect(r.drawConfigFrozenAt).toBeNull();
  });
});
