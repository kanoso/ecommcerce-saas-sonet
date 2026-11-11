import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { commitmentHash, generateSeed } from '@kanoso/raffle-draw';
import { SeedVault } from '../../application/ports';
import { SeedKeyProvider } from './seed-key-provider';

const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Seals each raffle's seed with AES-256-GCM. The raffle id is the
 * additional data, so a ciphertext copied onto another raffle does not open.
 * Format: `v1.<keyId>.<iv>.<tag>.<ciphertext>`, base64url parts.
 */
export class AesGcmSeedVault implements SeedVault {
  constructor(private readonly keys: SeedKeyProvider) {}

  async generateAndStoreSeed(raffleId: string): Promise<{
    commitmentHash: string;
    seedCiphertext: string;
  }> {
    const seed = generateSeed();
    const { id, key } = await this.keys.currentKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, iv, {
      authTagLength: TAG_BYTES,
    });
    cipher.setAAD(Buffer.from(raffleId, 'utf8'));
    const body = Buffer.concat([cipher.update(seed, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      commitmentHash: await commitmentHash(seed),
      seedCiphertext: [
        VERSION,
        id,
        iv.toString('base64url'),
        tag.toString('base64url'),
        body.toString('base64url'),
      ].join('.'),
    };
  }

  async revealSeed(raffleId: string, seedCiphertext: string): Promise<string> {
    const parts = seedCiphertext.split('.');
    if (parts.length !== 5 || parts[0] !== VERSION) {
      throw new Error(`Unknown seed ciphertext format for raffle ${raffleId}`);
    }
    const [, keyId, ivPart, tagPart, bodyPart] = parts;
    const { key } = await this.keys.keyById(keyId);

    let seed: string;
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(ivPart, 'base64url'),
        { authTagLength: TAG_BYTES },
      );
      decipher.setAAD(Buffer.from(raffleId, 'utf8'));
      decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
      seed = Buffer.concat([
        decipher.update(Buffer.from(bodyPart, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // No detail: the reason a seed does not open is nobody's business.
      throw new Error(`The seed of raffle ${raffleId} cannot be decrypted`);
    }
    if (!/^[0-9a-f]{64}$/.test(seed)) {
      throw new Error(`The seed of raffle ${raffleId} cannot be decrypted`);
    }
    return seed;
  }
}
