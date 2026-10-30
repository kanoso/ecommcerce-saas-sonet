import { commitmentHash, generateSeed } from '@kanoso/raffle-draw';
import { SeedVault } from '../ports/seed-vault';

export class FakeSeedVault implements SeedVault {
  // map: raffleId -> seedHex
  private vault = new Map<string, string>();

  setExplicitSeed(raffleId: string, seedHex: string): void {
    this.vault.set(raffleId, seedHex);
  }

  async generateAndStoreSeed(raffleId: string): Promise<{
    commitmentHash: string;
    seedCiphertext: string;
  }> {
    const seed = this.vault.get(raffleId) ?? generateSeed();
    this.vault.set(raffleId, seed);
    const hash = await commitmentHash(seed);
    const ciphertext = `enc_${Buffer.from(seed, 'utf-8').toString('base64')}`;
    return {
      commitmentHash: hash,
      seedCiphertext: ciphertext,
    };
  }

  async revealSeed(raffleId: string, seedCiphertext: string): Promise<string> {
    const seed = this.vault.get(raffleId);
    if (seed) {
      return seed;
    }
    if (seedCiphertext.startsWith('enc_')) {
      const b64 = seedCiphertext.replace('enc_', '');
      return Buffer.from(b64, 'base64').toString('utf-8');
    }
    throw new Error(`Seed not found in vault for raffle ${raffleId}`);
  }

  clear(): void {
    this.vault.clear();
  }
}
