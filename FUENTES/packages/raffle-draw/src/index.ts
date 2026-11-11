/**
 * @kanoso/raffle-draw
 *
 * Verifiable raffle winner calculation algorithm using commit-reveal + drand.
 * Specification: GUIA-IMPLEMENTACION-RIFAS §5.1, §5.2
 *
 * Web Crypto API is used exclusively to guarantee identical execution
 * in Node.js (18+) and modern web browsers without any framework or Node-specific dependencies.
 */

export const ALGORITHM_VERSION = 'v1';

export interface ChainConfig {
  genesisTimeSec: number;
  periodSec: number;
}

export interface ComputeWinnerInput {
  seedHex: string;
  drandRandomnessHex: string;
  raffleId: string;
  soldNumbers: number[];
}

export interface ComputeWinnerOutput {
  index: number;
  winner: number;
  digestHex: string;
}

export interface DrawExtraction {
  attempt: number;
  number: number;
  index: number;
  digestHex: string;
  isWinner: boolean;
}

export interface ComputeWinnerSequenceInput {
  seedHex: string;
  drandRandomnessHex: string;
  raffleId: string;
  soldNumbers: number[];
  winningAttempt?: number;
}

export interface ComputeWinnerSequenceOutput {
  winningTicket: number;
  winnerIndex: number;
  digestHex: string;
  winningAttempt: number;
  extractions: DrawExtraction[];
}

/**
 * Encodes a Uint8Array into a lowercase hex string.
 */
function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Decodes a hex string into a Uint8Array.
 * Throws if the input is not a valid hex string of expected byte length.
 */
function hexToBytes(hex: string, expectedByteLength?: number): Uint8Array {
  if (typeof hex !== 'string' || !/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error(`Invalid hex string: ${hex}`);
  }
  const byteLength = hex.length / 2;
  if (expectedByteLength !== undefined && byteLength !== expectedByteLength) {
    throw new Error(
      `Invalid byte length: expected ${expectedByteLength} bytes (${expectedByteLength * 2} hex chars), got ${byteLength} bytes`,
    );
  }
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Computes SHA-256 hash over bytes using Web Crypto API.
 */
async function sha256(bytes: Uint8Array): Promise<string> {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is not available in the current environment.');
  }
  const hashBuffer = await cryptoObj.subtle.digest(
    'SHA-256',
    bytes as unknown as BufferSource,
  );
  return bytesToHex(new Uint8Array(hashBuffer));
}

/**
 * Generates a 32-byte CSPRNG random seed, returned as a 64-char lowercase hex string.
 */
export function generateSeed(): string {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    throw new Error('CSPRNG (crypto.getRandomValues) is not available.');
  }
  const bytes = new Uint8Array(32);
  cryptoObj.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/**
 * Calculates commitment hash from raw seed bytes:
 * hex(SHA-256(seedBytes))
 */
export async function commitmentHash(seedHex: string): Promise<string> {
  const seedBytes = hexToBytes(seedHex, 32);
  return sha256(seedBytes);
}

/**
 * Verifies whether a given seed matches an expected commitment hash.
 */
export async function verifyCommitment(seedHex: string, commitmentHex: string): Promise<boolean> {
  try {
    const computed = await commitmentHash(seedHex);
    return computed === commitmentHex.toLowerCase().trim();
  } catch {
    return false;
  }
}

/**
 * Normalizes an array of sold numbers:
 * - Validates all numbers are non-negative safe integers.
 * - Deduplicates numbers.
 * - Sorts them ascending.
 */
export function normalizeSoldNumbers(numbers: number[]): number[] {
  if (!Array.isArray(numbers)) {
    throw new Error('soldNumbers must be an array of numbers');
  }

  for (const n of numbers) {
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || !Number.isFinite(n)) {
      throw new Error(`Invalid ticket number: ${n}. Must be a non-negative integer.`);
    }
  }

  const unique = Array.from(new Set(numbers));
  return unique.sort((a, b) => a - b);
}

/**
 * Computes hash of the sold numbers list:
 * hex(SHA-256(utf8(soldNumbers.join(","))))
 */
export async function soldListHash(sortedNumbers: number[]): Promise<string> {
  const normalized = normalizeSoldNumbers(sortedNumbers);
  const text = normalized.join(',');
  const utf8Bytes = new TextEncoder().encode(text);
  return sha256(utf8Bytes);
}

/**
 * Computes the verifiable winning ticket:
 * digest = SHA-256(seedBytes || drandRandomnessBytes || utf8(raffleId))
 * index  = BigInt("0x" + hex(digest)) % BigInt(soldNumbers.length)
 * winner = soldNumbers[Number(index)]
 */
export async function computeWinner(input: ComputeWinnerInput): Promise<ComputeWinnerOutput> {
  const { seedHex, drandRandomnessHex, raffleId, soldNumbers } = input;

  if (!Array.isArray(soldNumbers) || soldNumbers.length === 0) {
    throw new Error('Cannot compute winner: soldNumbers array is empty.');
  }

  const seedBytes = hexToBytes(seedHex, 32);
  const drandBytes = hexToBytes(drandRandomnessHex, 32);
  const raffleIdBytes = new TextEncoder().encode(raffleId.toLowerCase().trim());

  // Concatenate seedBytes || drandRandomnessBytes || utf8(raffleId)
  const combined = new Uint8Array(seedBytes.length + drandBytes.length + raffleIdBytes.length);
  combined.set(seedBytes, 0);
  combined.set(drandBytes, seedBytes.length);
  combined.set(raffleIdBytes, seedBytes.length + drandBytes.length);

  const digestHex = await sha256(combined);

  const digestBigInt = BigInt('0x' + digestHex);
  const indexBigInt = digestBigInt % BigInt(soldNumbers.length);
  const index = Number(indexBigInt);
  const winner = soldNumbers[index];

  return {
    index,
    winner,
    digestHex,
  };
}

/**
 * Computes a sequential sampling of winning attempts without replacement.
 *
 * For k = 1: digest is SHA-256(seedBytes || drandRandomnessBytes || utf8(raffleId))
 * For k > 1: digest is SHA-256(seedBytes || drandRandomnessBytes || utf8(raffleId) || utf8(":attempt:" + k))
 *
 * Each step k extracts a ticket from remaining tickets. The final extraction (k = winningAttempt)
 * is marked isWinner: true ("Ganador Oficial"), while prior extractions are marked isWinner: false ("Al agua").
 */
export async function computeWinnerSequence(
  input: ComputeWinnerSequenceInput,
): Promise<ComputeWinnerSequenceOutput> {
  const { seedHex, drandRandomnessHex, raffleId, soldNumbers } = input;
  const winningAttempt = input.winningAttempt ?? 1;

  if (!Number.isInteger(winningAttempt) || winningAttempt < 1 || winningAttempt > 5) {
    throw new Error(
      `Invalid winningAttempt: ${winningAttempt}. winningAttempt must be an integer between 1 and 5.`,
    );
  }

  if (!Array.isArray(soldNumbers) || soldNumbers.length < winningAttempt) {
    throw new Error(
      `Cannot compute winner sequence: soldNumbers length (${soldNumbers ? soldNumbers.length : 0}) is less than winningAttempt (${winningAttempt}).`,
    );
  }

  const seedBytes = hexToBytes(seedHex, 32);
  const drandBytes = hexToBytes(drandRandomnessHex, 32);
  const raffleIdBytes = new TextEncoder().encode(raffleId.toLowerCase().trim());

  const basePayload = new Uint8Array(seedBytes.length + drandBytes.length + raffleIdBytes.length);
  basePayload.set(seedBytes, 0);
  basePayload.set(drandBytes, seedBytes.length);
  basePayload.set(raffleIdBytes, seedBytes.length + drandBytes.length);

  const remaining = [...soldNumbers];
  const extractions: DrawExtraction[] = [];

  for (let k = 1; k <= winningAttempt; k++) {
    let payload = basePayload;
    if (k > 1) {
      const suffix = new TextEncoder().encode(`:attempt:${k}`);
      const combined = new Uint8Array(basePayload.length + suffix.length);
      combined.set(basePayload, 0);
      combined.set(suffix, basePayload.length);
      payload = combined;
    }

    const digestHex = await sha256(payload);
    const digestBigInt = BigInt('0x' + digestHex);
    const subIndex = Number(digestBigInt % BigInt(remaining.length));
    const chosenNumber = remaining[subIndex];
    const origIndex = soldNumbers.indexOf(chosenNumber);

    remaining.splice(subIndex, 1);

    extractions.push({
      attempt: k,
      number: chosenNumber,
      index: origIndex,
      digestHex,
      isWinner: k === winningAttempt,
    });
  }

  const winnerExtraction = extractions[extractions.length - 1];

  return {
    winningTicket: winnerExtraction.number,
    winnerIndex: winnerExtraction.index,
    digestHex: winnerExtraction.digestHex,
    winningAttempt,
    extractions,
  };
}

/**
 * Returns the drand round scheduled at a given UNIX epoch timestamp (in milliseconds).
 */
export function roundAt(timeMs: number, chain: ChainConfig): number {
  if (typeof timeMs !== 'number' || !Number.isFinite(timeMs)) {
    throw new Error(`Invalid timeMs: ${timeMs}`);
  }
  const timeSec = Math.floor(timeMs / 1000);
  if (timeSec < chain.genesisTimeSec) {
    return 1;
  }
  return Math.floor((timeSec - chain.genesisTimeSec) / chain.periodSec) + 1;
}

/**
 * Returns the UNIX epoch timestamp (in milliseconds) at which a given drand round begins.
 */
export function timeOfRound(round: number, chain: ChainConfig): number {
  if (typeof round !== 'number' || !Number.isInteger(round) || round < 1) {
    throw new Error(`Invalid round: ${round}. Must be an integer >= 1.`);
  }
  const timeSec = chain.genesisTimeSec + (round - 1) * chain.periodSec;
  return timeSec * 1000;
}
