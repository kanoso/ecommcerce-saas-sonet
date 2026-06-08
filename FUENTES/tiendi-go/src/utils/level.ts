export type Level = 'Bronce' | 'Plata' | 'Oro';

export function computeLevel(
  ratingAvg: number | null | undefined,
  ratingCount: number | null | undefined,
): Level | null {
  if (!ratingCount || ratingCount === 0) return null;
  if (ratingAvg == null) return null;
  if (ratingAvg >= 4.2) return 'Oro';
  if (ratingAvg >= 3.5) return 'Plata';
  return 'Bronce';
}
