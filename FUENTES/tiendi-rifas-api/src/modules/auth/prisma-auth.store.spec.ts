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
    updateMany: jest.fn(),
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

  describe('setPasswordIfUnset', () => {
    it('writes only where no password is set, in one statement', async () => {
      user.updateMany.mockResolvedValue({ count: 1 });

      await expect(store.setPasswordIfUnset('u-1', 'hash')).resolves.toBe(true);
      expect(user.updateMany).toHaveBeenCalledWith({
        where: { id: 'u-1', passwordHash: null },
        data: { passwordHash: 'hash' },
      });
    });

    it('reports false when the user already had a password', async () => {
      user.updateMany.mockResolvedValue({ count: 0 });

      await expect(store.setPasswordIfUnset('u-1', 'hash')).resolves.toBe(false);
    });
  });
});
