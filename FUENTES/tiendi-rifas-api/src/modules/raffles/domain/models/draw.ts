import type { DrawExtraction } from '@kanoso/raffle-draw';

export interface DrawProps {
  id: string;
  raffleId: string;
  algorithmVersion: string;
  seedRevealed: string;
  drandRandomness: string;
  drandRound: bigint;
  digestHex: string;
  totalSold: number;
  winningTicketId: string;
  winningNumber: number;
  winnerIndex: number;
  winningAttempt?: number;
  extractions?: DrawExtraction[];
  executedAt?: Date;
}

export class Draw {
  readonly id: string;
  readonly raffleId: string;
  readonly algorithmVersion: string;
  readonly seedRevealed: string;
  readonly drandRandomness: string;
  readonly drandRound: bigint;
  readonly digestHex: string;
  readonly totalSold: number;
  readonly winningTicketId: string;
  readonly winningNumber: number;
  readonly winnerIndex: number;
  readonly winningAttempt: number;
  readonly extractions: DrawExtraction[];
  readonly executedAt: Date;

  constructor(props: DrawProps) {
    this.id = props.id;
    this.raffleId = props.raffleId;
    this.algorithmVersion = props.algorithmVersion;
    this.seedRevealed = props.seedRevealed;
    this.drandRandomness = props.drandRandomness;
    this.drandRound = props.drandRound;
    this.digestHex = props.digestHex;
    this.totalSold = props.totalSold;
    this.winningTicketId = props.winningTicketId;
    this.winningNumber = props.winningNumber;
    this.winnerIndex = props.winnerIndex;
    this.winningAttempt = props.winningAttempt ?? 1;
    this.extractions = props.extractions ?? [];
    this.executedAt = props.executedAt ?? new Date();
  }
}
