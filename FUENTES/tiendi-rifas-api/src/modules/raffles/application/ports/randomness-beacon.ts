export interface DrandBeaconRound {
  round: bigint;
  randomness: string; // 32-byte hex
  signature: string;
}

export interface RandomnessBeacon {
  /**
   * The round, its signature already verified against the chain's key.
   * Only ever by number: nothing here can pick a round by when it is asked.
   * @throws BeaconRoundUnavailableError while no relay can give it.
   */
  getRound(round: bigint): Promise<DrandBeaconRound>;
  getChainInfo(): Promise<{
    chainHash: string;
    genesisTimeSec: number;
    periodSec: number;
  }>;
}

/**
 * No relay could give a verified round: it is not published yet, the relays
 * are down, or every answer failed verification. Worth trying again; not a
 * domain error.
 */
export class BeaconRoundUnavailableError extends Error {
  constructor(
    public readonly round: bigint,
    public readonly causes: string[] = [],
  ) {
    super(
      `drand round ${round.toString()} is not available${
        causes.length > 0 ? `: ${causes.join('; ')}` : ''
      }`,
    );
    this.name = 'BeaconRoundUnavailableError';
  }
}

