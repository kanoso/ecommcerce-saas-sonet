import { Injectable, InjectionToken, inject } from '@angular/core';
// A static import on purpose: the verification route is lazy, so this costs
// the first paint nothing, and the dev server's prebundler sees the package
// at page load. Loaded on demand, it was discovered only on "Recalcular",
// and the re-optimization reloaded the page mid-check (flaky e2e).
import { bls12_381 } from '@noble/curves/bls12-381';
import { abortError, sleep, throwIfAborted } from './abort';
import { bytesToHex, hexToBytes, sha256 } from './bytes';
import { DRAND_RELAYS, QUICKNET } from './quicknet';

/** The part of a fetch Response the client reads. */
export interface DrandResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type DrandFetch = (url: string, init: { signal: AbortSignal }) => Promise<DrandResponse>;

/**
 * The browser's own fetch: drand is asked directly, never through the
 * platform (V-01). No cookies and no referrer go to the relays.
 */
export const DRAND_FETCH = new InjectionToken<DrandFetch>('DRAND_FETCH', {
  providedIn: 'root',
  factory: () => (url, init) =>
    fetch(url, { ...init, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' }),
});

export interface DrandSettings {
  relays: readonly string[];
  /** Time each relay gets before the next one is asked. */
  timeoutMs: number;
}

export const DRAND_SETTINGS = new InjectionToken<DrandSettings>('DRAND_SETTINGS', {
  providedIn: 'root',
  factory: () => ({ relays: DRAND_RELAYS, timeoutMs: 5000 }),
});

export type RelayFailureReason =
  | 'network'
  | 'timeout'
  | 'http'
  | 'not-yet'
  | 'malformed'
  | 'wrong-round'
  | 'bad-randomness'
  | 'bad-signature';

/** Why one relay's answer was not used. `relay` is its host name. */
export interface RelayFailure {
  relay: string;
  reason: RelayFailureReason;
  status?: number;
}

/** A round whose BLS signature verified against the pinned quicknet key. */
export interface VerifiedRound {
  /** Decimal string: a round can outgrow a JS number. */
  round: string;
  randomness: string;
  signature: string;
}

export class DrandRoundUnavailableError extends Error {
  constructor(
    readonly round: string,
    readonly causes: RelayFailure[],
    /**
     * At least one relay said the round does not exist yet (404 or 425 Too
     * Early) and none served it: worth asking again, even if others are down.
     */
    readonly notYetPublished: boolean,
  ) {
    super(`drand round ${round} unavailable`);
    this.name = 'DrandRoundUnavailableError';
  }
}

/** One finished pass over the relays while polling, for a progress display. */
export interface RoundPollProgress {
  /** 1 for the first pass. */
  attempt: number;
  /** Why each relay did not serve the round on this pass. */
  relays: RelayFailure[];
  elapsedMs: number;
}

export interface RoundPollOptions {
  /** Wait between passes while the round is not published. */
  intervalMs: number;
  /** Total time, from the first request, after which polling gives up. */
  maxWaitMs: number;
  signal?: AbortSignal;
  onProgress?: (progress: RoundPollProgress) => void;
}

/** bls-unchained-g1-rfc9380: signatures on G1, keys on G2. */
const DST = 'BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_';
const HEX = /^[0-9a-f]+$/;
const ROUND = /^[1-9][0-9]*$/;

class RelayRefusal extends Error {
  constructor(
    readonly reason: RelayFailureReason,
    readonly status?: number,
  ) {
    super(reason);
  }
}

/**
 * Reads one quicknet round from the public relays, one after another, and
 * trusts none of them (V-02, V-03): every answer is checked against the
 * pinned public key, so a relay can make a round late but never change it.
 * The same checks as the API's DrandHttpBeacon, with the same library.
 */
@Injectable({ providedIn: 'root' })
export class DrandClient {
  private readonly fetch = inject(DRAND_FETCH);
  private readonly settings = inject(DRAND_SETTINGS);

  /** One pass over the relays; the round is asked for by number only (DT-18). */
  /**
   * Asks for the round until it is served, as the live page needs once its
   * countdown ends (V-05: the clock only bounds the wait, never picks a round).
   * A pass is repeated only while some relay says the round does not exist
   * yet; any other failure ends at once. Rejects with an AbortError when the
   * signal aborts, leaving no request or timer behind.
   */
  async pollRound(round: string, options: RoundPollOptions): Promise<VerifiedRound> {
    const startedAt = Date.now();
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.getRound(round, options.signal);
      } catch (error) {
        if (!(error instanceof DrandRoundUnavailableError)) {
          throw error;
        }
        const elapsedMs = Date.now() - startedAt;
        options.onProgress?.({ attempt, relays: error.causes, elapsedMs });
        if (!error.notYetPublished || elapsedMs + options.intervalMs > options.maxWaitMs) {
          throw error;
        }
        await sleep(options.intervalMs, options.signal);
      }
    }
  }

  /** One pass over the relays; the round is asked for by number only (DT-18). */
  async getRound(round: string, signal?: AbortSignal): Promise<VerifiedRound> {
    if (!ROUND.test(round)) {
      throw new Error(`Not a drand round: ${round}`);
    }
    const causes: RelayFailure[] = [];
    for (const relay of this.settings.relays) {
      throwIfAborted(signal);
      const host = new URL(relay).host;
      try {
        const body = await this.get(`${relay}/${QUICKNET.chainHash}/public/${round}`, signal);
        return await verifyRound(body, round);
      } catch (error) {
        if (signal?.aborted) {
          throw abortError();
        }
        causes.push(failureOf(host, error));
      }
    }
    const notYetPublished = causes.some((cause) => cause.reason === 'not-yet');
    throw new DrandRoundUnavailableError(round, causes, notYetPublished);
  }

  /** One request, cut by the relay timeout or by the caller's signal. */
  private async get(url: string, signal?: AbortSignal): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.settings.timeoutMs);
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      const response = await this.fetch(url, { signal: controller.signal });
      if (response.status === 404 || response.status === 425) {
        throw new RelayRefusal('not-yet', response.status);
      }
      if (!response.ok) {
        throw new RelayRefusal('http', response.status);
      }
      return await response.json();
    } catch (error) {
      if (controller.signal.aborted && !signal?.aborted) {
        throw new RelayRefusal('timeout');
      }
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }
}

function failureOf(relay: string, error: unknown): RelayFailure {
  if (error instanceof RelayRefusal) {
    return error.status === undefined
      ? { relay, reason: error.reason }
      : { relay, reason: error.reason, status: error.status };
  }
  if (error instanceof SyntaxError) {
    return { relay, reason: 'malformed' };
  }
  return { relay, reason: 'network' };
}

/** The round, verified, or a RelayRefusal saying why not. */
async function verifyRound(body: unknown, expected: string): Promise<VerifiedRound> {
  if (typeof body !== 'object' || body === null) {
    throw new RelayRefusal('malformed');
  }
  const { round, randomness, signature } = body as Record<string, unknown>;
  if (
    typeof round !== 'number' ||
    !Number.isSafeInteger(round) ||
    typeof randomness !== 'string' ||
    typeof signature !== 'string' ||
    !HEX.test(randomness) ||
    randomness.length !== 64 ||
    !HEX.test(signature) ||
    signature.length !== 96
  ) {
    throw new RelayRefusal('malformed');
  }
  if (String(round) !== expected) {
    throw new RelayRefusal('wrong-round');
  }

  const signatureBytes = hexToBytes(signature);
  if (bytesToHex(await sha256(signatureBytes)) !== randomness) {
    throw new RelayRefusal('bad-randomness');
  }

  // The signed message of an unchained round: SHA-256 of the round as uint64 BE.
  const roundBytes = new DataView(new ArrayBuffer(8));
  roundBytes.setBigUint64(0, BigInt(expected));
  const message = await sha256(new Uint8Array(roundBytes.buffer));

  let valid: boolean;
  try {
    const sigs = bls12_381.shortSignatures;
    valid = sigs.verify(signatureBytes, sigs.hash(message, DST), hexToBytes(QUICKNET.publicKeyHex));
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new RelayRefusal('bad-signature');
  }
  return { round: expected, randomness, signature };
}
