/** A 256-bit key and the id stored next to every ciphertext it sealed. */
export interface SeedKey {
  id: string;
  key: Buffer;
}

/**
 * Where the seed encryption key comes from. Production must use the secrets
 * manager (OpenBao, DOCS/SEGURIDAD/OPENBAO_IMPLEMENTATION_GUIDE.md); that
 * provider is not built yet.
 */
export interface SeedKeyProvider {
  /** The key new seeds are sealed with. */
  currentKey(): Promise<SeedKey>;
  /** The key an old ciphertext names, so keys can rotate. */
  keyById(id: string): Promise<SeedKey>;
}

const ENV_KEY_ID = 'env';

/**
 * Development and test only: the key comes from SEED_ENCRYPTION_KEY
 * (base64, 32 bytes). Refused in production, where a key in the process
 * environment is one leak away from revealing every seed early.
 */
export class EnvSeedKeyProvider implements SeedKeyProvider {
  private readonly key: Buffer | null;

  constructor(config: { nodeEnv: string; keyBase64?: string }) {
    if (config.nodeEnv === 'production') {
      throw new Error(
        'SEED_ENCRYPTION_KEY is not allowed in production: configure the secrets manager',
      );
    }
    if (!config.keyBase64) {
      this.key = null;
      return;
    }
    const key = Buffer.from(config.keyBase64, 'base64');
    if (key.length !== 32) {
      throw new Error('SEED_ENCRYPTION_KEY must be 32 bytes in base64');
    }
    this.key = key;
  }

  async currentKey(): Promise<SeedKey> {
    if (!this.key) {
      throw new Error(
        'SEED_ENCRYPTION_KEY is not set: seeds cannot be sealed or revealed',
      );
    }
    return { id: ENV_KEY_ID, key: this.key };
  }

  async keyById(id: string): Promise<SeedKey> {
    if (id !== ENV_KEY_ID) {
      throw new Error(`Unknown seed key ${id}`);
    }
    return this.currentKey();
  }
}
