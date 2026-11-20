import { DIGITS, excludedBefore, playableCells, poolOf, unitDigitsFor } from './draw-pool';

describe('draw pool helpers', () => {
  const prizes = [
    { position: 1, won: true, excludedTickets: [4, 9, 82] },
    { position: 2, won: false, excludedTickets: [5] },
    { position: 3, won: true, excludedTickets: [7] },
  ];

  it('lists the ten unit digits', () => {
    expect(DIGITS).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('maps each ticket taken by a won prize before the given one to that prize', () => {
    expect([...excludedBefore(prizes, 0)]).toEqual([]);
    expect([...excludedBefore(prizes, 1)]).toEqual([
      [4, 1],
      [9, 1],
      [82, 1],
    ]);
    // A prize that was not won takes nothing out, whatever it lists.
    expect(excludedBefore(prizes, 2).has(5)).toBe(false);
    expect(excludedBefore(prizes, 3).get(7)).toBe(3);
  });

  it('keeps the first prize that took a ticket', () => {
    const twice = [
      { position: 1, won: true, excludedTickets: [4] },
      { position: 2, won: true, excludedTickets: [4, 6] },
    ];
    expect(excludedBefore(twice, 2).get(4)).toBe(1);
  });

  it('takes the excluded tickets out of the pool, in order', () => {
    const excluded = excludedBefore(prizes, 1);
    expect(poolOf([1, 4, 5, 9, 12, 82], excluded)).toEqual([1, 5, 12]);
    const sold = [1, 2];
    expect(poolOf(sold, new Map())).toBe(sold);
  });

  it('leaves out of the board cells the decoys may stop on the excluded ones', () => {
    const excluded = new Map([
      [2, 1],
      [3, 1],
    ]);
    expect(playableCells([1, 2, 3, 4], excluded)).toEqual([1, 4]);
    expect(playableCells([2, 3], excluded)).toEqual([2, 3]);
  });

  it('offers only the unit digits of the locked decade that are still in play', () => {
    const excluded = new Map([
      [40, 1],
      [44, 1],
      [49, 1],
    ]);
    expect(unitDigitsFor(4, excluded)).toEqual([1, 2, 3, 5, 6, 7, 8]);
    expect(unitDigitsFor(1, excluded)).toEqual(DIGITS);
  });
});
