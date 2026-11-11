import { createHash } from 'crypto';
import { bls12_381 } from '@noble/curves/bls12-381';
import {
  BeaconRoundUnavailableError,
  DrandBeaconRound,
  RandomnessBeacon,
} from '../../application/ports';

/** The part of `fetch` the adapter needs, so tests never touch the network. */
export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface DrandChainConfig {
  chainHash: string;
  /** G2 public key of the chain, hex (quicknet, DT-01). */
  publicKeyHex: string;
  genesisTimeSec: number;
  periodSec: number;
  groupHashHex: string;
  beaconId: string;
}

export interface DrandHttpBeaconConfig extends DrandChainConfig {
  relays: string[];
  timeoutMs: number;
  fetch?: FetchLike;
}

/**
 * drand's chain hash: SHA-256 of the period (uint32), the genesis time
 * (int64), the public key, the group hash and the beacon id, big-endian.
 */
export function chainHashOf(chain: DrandChainConfig): string {
  const period = Buffer.alloc(4);
  period.writeUInt32BE(chain.periodSec);
  const genesis = Buffer.alloc(8);
  genesis.writeBigInt64BE(BigInt(chain.genesisTimeSec));
  return createHash('sha256')
    .update(period)
    .update(genesis)
    .update(Buffer.from(chain.publicKeyHex, 'hex'))
    .update(Buffer.from(chain.groupHashHex, 'hex'))
    .update(Buffer.from(chain.beaconId, 'utf8'))
    .digest('hex');
}

/**
 * The relays to ask: https only, each origin once. A relay is never trusted
 * (every round is BLS-verified), but a plain-http one would let anyone on
 * the path see and stall the draw.
 */
export function parseRelays(relays: string[]): string[] {
  const unique = new Map<string, string>();
  for (const raw of relays) {
    const entry = raw.trim();
    if (entry.length === 0) continue;
    let parsed: URL;
    try {
      parsed = new URL(entry);
    } catch {
      throw new Error(`drand relay ${entry} must be an https URL`);
    }
    if (parsed.protocol !== 'https:') {
      throw new Error(`drand relay ${entry} must be an https URL`);
    }
    if (!unique.has(parsed.origin)) {
      unique.set(parsed.origin, parsed.origin + parsed.pathname.replace(/\/+$/, ''));
    }
  }
  return [...unique.values()];
}

/** bls-unchained-g1-rfc9380: signatures on G1, keys on G2. */
const DST = 'BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_';
const HEX = /^[0-9a-f]+$/;

/**
 * Reads rounds from several drand relays and trusts none of them: every
 * answer is checked against the chain's public key, so a relay can make a
 * round late but never change it.
 */
export class DrandHttpBeacon implements RandomnessBeacon {
  private readonly relays: string[];
  private readonly fetch: FetchLike;

  constructor(private readonly config: DrandHttpBeaconConfig) {
    this.relays = parseRelays(config.relays);
    if (this.relays.length === 0) {
      throw new Error('The beacon needs at least one drand relay');
    }
    if (!HEX.test(config.publicKeyHex) || config.publicKeyHex.length !== 192) {
      throw new Error('The drand public key must be a 96-byte hex G2 point');
    }
    // No network: the configured key, period and genesis must be the chain
    // the hash names, or a typo would verify rounds of another chain.
    if (chainHashOf(config) !== config.chainHash) {
      throw new Error(
        'DRAND_CHAIN_HASH does not match DRAND_PUBLIC_KEY, the period, the genesis time, the group hash and the beacon id',
      );
    }
    this.fetch = config.fetch ?? (globalThis.fetch as unknown as FetchLike);
  }

  getRound(round: bigint): Promise<DrandBeaconRound> {
    return this.firstVerified(round);
  }

  /** From configuration: a relay must not be able to move the schedule. */
  async getChainInfo(): Promise<{
    chainHash: string;
    genesisTimeSec: number;
    periodSec: number;
  }> {
    return {
      chainHash: this.config.chainHash,
      genesisTimeSec: this.config.genesisTimeSec,
      periodSec: this.config.periodSec,
    };
  }

  private async firstVerified(expected: bigint): Promise<DrandBeaconRound> {
    const causes: string[] = [];
    for (const [index, relay] of this.relays.entries()) {
      // Relays are numbered, not named: causes end up in logs.
      const label = `relay ${index + 1}`;
      try {
        const body = await this.get(
          `${relay}/${this.config.chainHash}/public/${expected.toString()}`,
        );
        const verified = this.verify(body, expected);
        if (typeof verified === 'string') {
          causes.push(`${label}: ${verified}`);
          continue;
        }
        return verified;
      } catch (error) {
        causes.push(`${label}: ${describe(error)}`);
      }
    }
    throw new BeaconRoundUnavailableError(expected, causes);
  }

  private async get(url: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /** The round, or why it was refused. */
  private verify(body: unknown, expected: bigint): DrandBeaconRound | string {
    if (typeof body !== 'object' || body === null) {
      return 'malformed answer';
    }
    const { round, randomness, signature } = body as Record<string, unknown>;
    if (
      typeof round !== 'number' ||
      !Number.isSafeInteger(round) ||
      round < 1 ||
      typeof randomness !== 'string' ||
      typeof signature !== 'string' ||
      !HEX.test(randomness) ||
      randomness.length !== 64 ||
      !HEX.test(signature) ||
      signature.length !== 96
    ) {
      return 'malformed answer';
    }
    const roundNumber = BigInt(round);
    if (roundNumber !== expected) {
      return `answered round ${round}`;
    }

    const signatureBytes = Buffer.from(signature, 'hex');
    const derived = createHash('sha256').update(signatureBytes).digest('hex');
    if (derived !== randomness) {
      return 'randomness is not the hash of the signature';
    }

    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(roundNumber);
    const digest = createHash('sha256').update(message).digest();
    let valid: boolean;
    try {
      const sigs = bls12_381.shortSignatures;
      valid = sigs.verify(
        signature,
        sigs.hash(digest, DST),
        this.config.publicKeyHex,
      );
    } catch {
      valid = false;
    }
    if (!valid) {
      return 'BLS signature does not verify';
    }
    return { round: roundNumber, randomness, signature };
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    return error.name === 'AbortError' ? 'timed out' : error.message;
  }
  return 'unknown error';
}
