export interface DrandBeaconRound {
  round: bigint;
  randomness: string; // 32-byte hex
  signature: string;
}

export interface RandomnessBeacon {
  getRound(round: bigint): Promise<DrandBeaconRound>;
  getChainInfo(): Promise<{
    chainHash: string;
    genesisTimeSec: number;
    periodSec: number;
  }>;
}
