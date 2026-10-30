import { DrandBeaconRound, RandomnessBeacon } from '../ports/randomness-beacon';

export class FakeRandomnessBeacon implements RandomnessBeacon {
  private rounds = new Map<string, DrandBeaconRound>();
  public chainHash = '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971';
  public genesisTimeSec = 1692803367;
  public periodSec = 3;

  setRound(round: bigint, randomnessHex: string, signatureHex = 'fake_bls_sig'): void {
    this.rounds.set(round.toString(), {
      round,
      randomness: randomnessHex,
      signature: signatureHex,
    });
  }

  async getRound(round: bigint): Promise<DrandBeaconRound> {
    const found = this.rounds.get(round.toString());
    if (found) {
      return found;
    }
    // Default deterministic fallback
    return {
      round,
      randomness: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
      signature: 'default_sig',
    };
  }

  async getChainInfo(): Promise<{
    chainHash: string;
    genesisTimeSec: number;
    periodSec: number;
  }> {
    return {
      chainHash: this.chainHash,
      genesisTimeSec: this.genesisTimeSec,
      periodSec: this.periodSec,
    };
  }

  clear(): void {
    this.rounds.clear();
  }
}
