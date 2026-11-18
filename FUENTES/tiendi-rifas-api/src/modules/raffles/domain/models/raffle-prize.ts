import { RaffleValidationError } from '../errors/domain.errors';

/** Upper bound of prizes per raffle; the same as @kanoso/raffle-draw MAX_PRIZES. */
export const MAX_RAFFLE_PRIZES = 20;

/** Upper bound of images per prize. */
export const MAX_PRIZE_IMAGES = 10;

/** One prize of a raffle. Position 1 is drawn first. */
export interface RafflePrize {
  readonly id: string;
  readonly position: number;
  readonly title: string;
  readonly description: string | null;
  readonly images: string[];
}

/** A prize as given by an operator: its position is its place in the list. */
export interface RafflePrizeInput {
  id: string;
  title: string;
  description?: string | null;
  images?: string[];
}

function validPrize(prize: RafflePrize): RafflePrize {
  if (typeof prize.title !== 'string' || prize.title.trim() === '') {
    throw new RaffleValidationError(`Prize ${prize.position} title cannot be empty`);
  }
  const images = prize.images ?? [];
  if (!Array.isArray(images) || images.length > MAX_PRIZE_IMAGES) {
    throw new RaffleValidationError(
      `Prize ${prize.position} cannot have more than ${MAX_PRIZE_IMAGES} images`,
    );
  }
  const description = prize.description?.trim() || null;
  return {
    id: prize.id,
    position: prize.position,
    title: prize.title.trim(),
    description,
    images: [...images],
  };
}

/**
 * Validates a stored prize list: 1..20 prizes at positions 1..N, no gaps.
 * @returns the prizes ordered by position.
 */
export function orderedPrizes(prizes: RafflePrize[]): RafflePrize[] {
  if (!Array.isArray(prizes) || prizes.length < 1) {
    throw new RaffleValidationError('A raffle needs at least one prize');
  }
  if (prizes.length > MAX_RAFFLE_PRIZES) {
    throw new RaffleValidationError(
      `A raffle cannot have more than ${MAX_RAFFLE_PRIZES} prizes`,
    );
  }
  const sorted = [...prizes].sort((a, b) => a.position - b.position);
  sorted.forEach((prize, i) => {
    if (prize.position !== i + 1) {
      throw new RaffleValidationError('Prize positions must be 1..N without gaps');
    }
  });
  return sorted.map(validPrize);
}

/** Positions follow the order of the list. */
export function prizesFromInputs(inputs: RafflePrizeInput[]): RafflePrize[] {
  return orderedPrizes(
    inputs.map((input, i) => ({
      id: input.id,
      position: i + 1,
      title: input.title,
      description: input.description ?? null,
      images: input.images ?? [],
    })),
  );
}
