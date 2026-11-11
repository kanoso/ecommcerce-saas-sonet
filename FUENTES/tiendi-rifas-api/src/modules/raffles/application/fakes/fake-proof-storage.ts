import { ProofContentType, ProofNotFoundError } from '../../domain';
import { ProofStorage, StoredProof } from '../ports/proof-storage';

export class FakeProofStorage implements ProofStorage {
  private files = new Map<string, StoredProof>();
  private nextKey = 1;
  private deleteFailure: Error | null = null;

  async save(
    content: Uint8Array,
    contentType: ProofContentType,
  ): Promise<string> {
    const key = `proof-${this.nextKey++}`;
    this.files.set(key, { content, contentType });
    return key;
  }

  async read(key: string): Promise<StoredProof> {
    const file = this.files.get(key);
    if (!file) {
      throw new ProofNotFoundError(key);
    }
    return file;
  }

  async delete(key: string): Promise<void> {
    if (this.deleteFailure) {
      throw this.deleteFailure;
    }
    this.files.delete(key);
  }

  keys(): string[] {
    return [...this.files.keys()];
  }

  failOnDelete(error: Error): void {
    this.deleteFailure = error;
  }
}
