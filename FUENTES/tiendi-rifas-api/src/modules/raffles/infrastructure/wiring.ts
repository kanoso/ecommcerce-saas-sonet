import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../../config/env.validation';
import { ProofPolicy, ReservationPolicy } from '../domain';
import { DrandHttpBeacon } from './drand/drand-http-beacon';
import { AesGcmSeedVault } from './seed-vault/aes-gcm-seed-vault';
import { EnvSeedKeyProvider } from './seed-vault/seed-key-provider';

/** Adapters built from configuration, shared by the jobs and the HTTP API. */
export type Env = ConfigService<EnvConfig, true>;

export const env = <K extends keyof EnvConfig>(config: Env, key: K): EnvConfig[K] =>
  config.get(key, { infer: true });

export function beaconFrom(config: Env): DrandHttpBeacon {
  return new DrandHttpBeacon({
    relays: env(config, 'DRAND_RELAYS').split(','),
    chainHash: env(config, 'DRAND_CHAIN_HASH'),
    publicKeyHex: env(config, 'DRAND_PUBLIC_KEY'),
    genesisTimeSec: env(config, 'DRAND_GENESIS_TIME'),
    periodSec: env(config, 'DRAND_PERIOD_SECONDS'),
    groupHashHex: env(config, 'DRAND_GROUP_HASH'),
    beaconId: env(config, 'DRAND_BEACON_ID'),
    timeoutMs: env(config, 'DRAND_TIMEOUT_MS'),
  });
}

/**
 * Production has no seed key provider yet: the secrets manager adapter is
 * pending. Using the vault there fails loudly, instead of closing a raffle
 * with a seed nobody can reveal.
 */
export function seedVaultFrom(config: Env): AesGcmSeedVault {
  return new AesGcmSeedVault(
    new EnvSeedKeyProvider({
      nodeEnv: env(config, 'NODE_ENV'),
      keyBase64: env(config, 'SEED_ENCRYPTION_KEY'),
    }),
  );
}

export function reservationPolicyFrom(config: Env): ReservationPolicy {
  return new ReservationPolicy({
    maxNumbersPerReservation: env(config, 'MAX_TICKETS_PER_RESERVATION'),
    maxActiveReservedPerBuyer: env(config, 'MAX_ACTIVE_RESERVED_PER_BUYER'),
    reservationTtlMinutes: env(config, 'RESERVATION_TTL_MINUTES'),
  });
}

export function proofPolicyFrom(config: Env): ProofPolicy {
  return new ProofPolicy({
    verificationTtlHours: env(config, 'PROOF_VERIFICATION_TTL_HOURS'),
    deadlineMinutesBeforeClose: env(config, 'PROOF_DEADLINE_MINUTES_BEFORE_CLOSE'),
    maxFileBytes: env(config, 'PROOF_MAX_FILE_BYTES'),
  });
}
