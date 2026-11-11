import { bytesToHex, hexToBytes, sha256 } from './bytes';

/**
 * quicknet, the chain of every draw (DT-01): bls-unchained-g1-rfc9380,
 * signatures on G1 and the key on G2. Pinned here, never read from a relay
 * or from the platform: neither must be able to swap the key.
 */
export const QUICKNET = {
  chainHash: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971',
  publicKeyHex:
    '83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a',
  groupHashHex: 'f477d5c89f21a17c863a7f937c6a6d15859414d2be09cd448d4279af331c5d3e',
  beaconId: 'quicknet',
  genesisTimeSec: 1692803367,
  periodSec: 3,
} as const;

/**
 * Public drand relays (spec V-02). Checked on 2026-11-03 with an
 * `Origin: http://localhost:4200` header: all answer
 * `Access-Control-Allow-Origin: *`, so the browser reads them directly (V-01).
 */
export const DRAND_RELAYS: readonly string[] = [
  'https://api.drand.sh',
  'https://drand.cloudflare.com',
  'https://api2.drand.sh',
  'https://api3.drand.sh',
];

/**
 * drand's chain hash: SHA-256 of the period (uint32), the genesis time
 * (int64), the public key, the group hash and the beacon id, big-endian.
 * The same formula as `chainHashOf` of the API's DrandHttpBeacon.
 */
export async function quicknetChainHash(): Promise<string> {
  const head = new DataView(new ArrayBuffer(12));
  head.setUint32(0, QUICKNET.periodSec);
  head.setBigInt64(4, BigInt(QUICKNET.genesisTimeSec));
  const parts = [
    new Uint8Array(head.buffer),
    hexToBytes(QUICKNET.publicKeyHex),
    hexToBytes(QUICKNET.groupHashHex),
    new TextEncoder().encode(QUICKNET.beaconId),
  ];
  const all = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    all.set(part, offset);
    offset += part.length;
  }
  return bytesToHex(await sha256(all));
}
