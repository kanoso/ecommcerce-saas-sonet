import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ProofStorage, StoredProof } from '../../application/ports';
import {
  InvalidProofKeyError,
  ProofContentType,
  ProofNotFoundError,
} from '../../domain';

const EXTENSIONS: Record<ProofContentType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const CONTENT_TYPES = Object.fromEntries(
  Object.entries(EXTENSIONS).map(([type, extension]) => [extension, type]),
) as Record<string, ProofContentType>;

// Exactly what save() generates. Nothing the client sends can name a path.
const KEY_FORMAT = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(png|jpg|webp|pdf)$/;

function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

/**
 * Private files on the server disk (DT-03). The directory must sit outside any
 * served path, survive redeploys and be part of the backups.
 */
export class LocalProofStorage implements ProofStorage {
  private readonly root: string;

  constructor(directory: string) {
    if (!directory.trim()) {
      throw new Error('The proof storage needs a directory');
    }
    this.root = path.resolve(directory);
  }

  async save(
    content: Uint8Array,
    contentType: ProofContentType,
  ): Promise<string> {
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
    const key = `${randomUUID()}.${EXTENSIONS[contentType]}`;
    await fs.writeFile(this.pathOf(key), content, { flag: 'wx', mode: 0o600 });
    return key;
  }

  async read(key: string): Promise<StoredProof> {
    const extension = this.assertValid(key);
    try {
      const content = await fs.readFile(this.pathOf(key));
      return { content, contentType: CONTENT_TYPES[extension] };
    } catch (error) {
      if (isNotFound(error)) {
        throw new ProofNotFoundError(key);
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    this.assertValid(key);
    await fs.rm(this.pathOf(key), { force: true });
  }

  private assertValid(key: string): string {
    const match = KEY_FORMAT.exec(key);
    if (!match) {
      throw new InvalidProofKeyError();
    }
    return match[1];
  }

  private pathOf(key: string): string {
    return path.join(this.root, key);
  }
}
