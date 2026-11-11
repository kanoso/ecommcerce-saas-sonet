import { Prisma } from '@prisma/client';
import { PrismaService } from '../raffles/infrastructure/persistence/prisma.service';
import { IdentifierTakenError } from './auth.errors';
import { PrismaAuthStore } from './prisma-auth.store';

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(`Error ${code}`, {
    code,
    clientVersion: 'test',
    meta: { target: ['document'] },
  });

describe('PrismaAuthStore (no database)', () => {
  const user = {
    create: jest.fn(),
  };
  const store = new PrismaAuthStore({ user } as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('createUser', () => {
    it('reports a unique violation as IdentifierTakenError', async () => {
      user.create.mockRejectedValue(knownError('P2002'));

      await expect(
        store.createUser({ document: '12345678', passwordHash: 'h' }),
      ).rejects.toThrow(IdentifierTakenError);
    });

    it('lets any other error through unchanged', async () => {
      const other = knownError('P2025');
      user.create.mockRejectedValue(other);

      await expect(
        store.createUser({ document: '12345678', passwordHash: 'h' }),
      ).rejects.toBe(other);
    });
  });
});
