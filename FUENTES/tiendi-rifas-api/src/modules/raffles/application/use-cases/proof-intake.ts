import { detectProofType, ProofContentType } from '../../domain';
import { ProofStorage } from '../ports';

/**
 * The file is written before the transaction and removed if it fails. The
 * worst outcome is then an unreferenced file, never an order pointing at
 * nothing. A failed removal must not hide the error that caused it.
 */
export async function withStoredProof<T>(
  storage: ProofStorage,
  file: Uint8Array | null | undefined,
  work: (proofKey: string | null) => Promise<T>,
): Promise<T> {
  const proofKey = file
    ? await storage.save(file, detectProofType(file) as ProofContentType)
    : null;

  try {
    return await work(proofKey);
  } catch (error) {
    if (proofKey) {
      await storage.delete(proofKey).catch(() => undefined);
    }
    throw error;
  }
}
