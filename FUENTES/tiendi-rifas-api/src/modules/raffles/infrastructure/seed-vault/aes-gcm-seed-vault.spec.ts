import { randomBytes } from 'crypto';
import { verifyCommitment } from '@kanoso/raffle-draw';
import { AesGcmSeedVault } from './aes-gcm-seed-vault';
import { EnvSeedKeyProvider, SeedKeyProvider } from './seed-key-provider';

const KEY = randomBytes(32).toString('base64');

function vaultWith(provider: SeedKeyProvider = devKey()): AesGcmSeedVault {
  return new AesGcmSeedVault(provider);
}

function devKey(key = KEY, nodeEnv = 'test'): EnvSeedKeyProvider {
  return new EnvSeedKeyProvider({ nodeEnv, keyBase64: key });
}

describe('AesGcmSeedVault', () => {
  it('reveals the seed whose hash it committed to', async () => {
    const vault = vaultWith();
    const { commitmentHash, seedCiphertext } =
      await vault.generateAndStoreSeed('raffle-1');

    const seed = await vault.revealSeed('raffle-1', seedCiphertext);

    expect(seed).toMatch(/^[0-9a-f]{64}$/);
    await expect(verifyCommitment(seed, commitmentHash)).resolves.toBe(true);
  });

  it('never stores the seed in clear text', async () => {
    const vault = vaultWith();
    const { seedCiphertext } = await vault.generateAndStoreSeed('raffle-1');
    const seed = await vault.revealSeed('raffle-1', seedCiphertext);

    expect(seedCiphertext).not.toContain(seed);
    expect(seedCiphertext.startsWith('v1.env.')).toBe(true);
  });

  it('gives each raffle its own seed and nonce', async () => {
    const vault = vaultWith();
    const a = await vault.generateAndStoreSeed('raffle-1');
    const b = await vault.generateAndStoreSeed('raffle-1');

    expect(a.seedCiphertext.split('.')[2]).not.toBe(
      b.seedCiphertext.split('.')[2],
    );
    expect(a.commitmentHash).not.toBe(b.commitmentHash);
  });

  it('refuses a ciphertext moved to another raffle', async () => {
    const vault = vaultWith();
    const { seedCiphertext } = await vault.generateAndStoreSeed('raffle-1');

    await expect(vault.revealSeed('raffle-2', seedCiphertext)).rejects.toThrow(
      'cannot be decrypted',
    );
  });

  it('refuses a tampered ciphertext', async () => {
    const vault = vaultWith();
    const { seedCiphertext } = await vault.generateAndStoreSeed('raffle-1');
    const parts = seedCiphertext.split('.');
    const body = Buffer.from(parts[4], 'base64url');
    body[0] ^= 0x01;
    parts[4] = body.toString('base64url');

    await expect(vault.revealSeed('raffle-1', parts.join('.'))).rejects.toThrow(
      'cannot be decrypted',
    );
  });

  it('refuses a ciphertext sealed with another key', async () => {
    const { seedCiphertext } = await vaultWith().generateAndStoreSeed('raffle-1');
    const other = vaultWith(devKey(randomBytes(32).toString('base64')));

    await expect(other.revealSeed('raffle-1', seedCiphertext)).rejects.toThrow(
      'cannot be decrypted',
    );
  });

  it('refuses an unknown format', async () => {
    await expect(vaultWith().revealSeed('raffle-1', 'enc_abc')).rejects.toThrow(
      'Unknown seed ciphertext format',
    );
  });
});

describe('EnvSeedKeyProvider', () => {
  it('is refused in production', () => {
    expect(() => devKey(KEY, 'production')).toThrow(
      'not allowed in production',
    );
  });

  it('needs a 32-byte key', () => {
    expect(() => devKey(randomBytes(16).toString('base64'))).toThrow(
      '32 bytes',
    );
  });

  it('fails on use, not at startup, when no key is configured', async () => {
    const provider = new EnvSeedKeyProvider({ nodeEnv: 'development' });

    await expect(provider.currentKey()).rejects.toThrow('SEED_ENCRYPTION_KEY');
  });

  it('only knows its own key id', async () => {
    await expect(devKey().keyById('openbao-1')).rejects.toThrow(
      'Unknown seed key',
    );
  });
});
