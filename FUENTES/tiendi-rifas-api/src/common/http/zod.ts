import { z } from 'zod';
import { ValidationFailedError } from './api-errors';

/** Parses a request part with zod, or throws the uniform 400. */
export function parseWith<T extends z.ZodTypeAny>(
  schema: T,
  value: unknown,
): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationFailedError(
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

export const uuidParam = z.string().uuid();
