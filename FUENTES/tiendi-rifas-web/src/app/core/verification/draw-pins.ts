import { Injectable, inject } from '@angular/core';
import { SESSION_STORAGE } from '../session/session.store';

export type PinField = 'commitmentHash' | 'drandRound' | 'drawAt' | 'salesCloseAt' | 'soldListHash';

export type PinnedValues = Partial<Record<PinField, string>>;

export type SeenValues = Partial<Record<PinField, string | null | undefined>>;

/** A value the platform shows now that differs from the one first seen here. */
export interface PinConflict {
  field: PinField;
  pinned: string;
  seen: string;
}

/**
 * - anchored: a value pinned on an earlier visit matched.
 * - first-visit: nothing was pinned before, so nothing could be compared.
 * - no-storage: the browser keeps no site data, or refuses it.
 */
export type PinStatus = 'anchored' | 'first-visit' | 'no-storage';

export interface PinReport {
  status: PinStatus;
  conflicts: PinConflict[];
}

const KEY_PREFIX = 'tiendi-rifas.pins.';
const FIELDS: readonly PinField[] = ['commitmentHash', 'drandRound', 'drawAt', 'salesCloseAt', 'soldListHash'];

/** Hashes compare case-insensitively and dates as instants, so only real changes count. */
function normalize(field: PinField, value: string): string {
  if (field === 'drawAt' || field === 'salesCloseAt') {
    const time = Date.parse(value);
    return Number.isNaN(time) ? value : new Date(time).toISOString();
  }
  return value.trim().toLowerCase();
}

function parsePins(raw: string | null): PinnedValues {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const pins: PinnedValues = {};
    for (const field of FIELDS) {
      const value = (parsed as Record<string, unknown> | null)?.[field];
      if (typeof value === 'string' && value !== '') {
        pins[field] = value;
      }
    }
    return pins;
  } catch {
    return {};
  }
}

/**
 * Trust on first use, per raffle and per browser (DT-20): the commitment,
 * the round, the draw date and the sales close as first seen, and the list
 * hash once frozen. A platform that later shows other values to this
 * browser is caught here, even if every check of the new values passes.
 */
@Injectable({ providedIn: 'root' })
export class DrawPins {
  // The same browser storage the session uses; null when the browser blocks it.
  private readonly storage = inject(SESSION_STORAGE);

  /** Compares with the pins without writing any. */
  check(raffleId: string, seen: SeenValues): PinReport {
    const pins = this.read(raffleId);
    if (pins === null) {
      return { status: 'no-storage', conflicts: [] };
    }
    const conflicts: PinConflict[] = [];
    let matched = false;
    for (const field of FIELDS) {
      const value = seen[field];
      const pinned = pins[field];
      if (!value || pinned === undefined) {
        continue;
      }
      const current = normalize(field, value);
      if (pinned === current) {
        matched = true;
      } else {
        conflicts.push({ field, pinned, seen: current });
      }
    }
    return { status: matched ? 'anchored' : 'first-visit', conflicts };
  }

  /** Pins every value not pinned yet; never replaces a pin. */
  pin(raffleId: string, seen: SeenValues): void {
    const pins = this.read(raffleId);
    if (pins === null) {
      return;
    }
    let changed = false;
    for (const field of FIELDS) {
      const value = seen[field];
      if (value && pins[field] === undefined) {
        pins[field] = normalize(field, value);
        changed = true;
      }
    }
    if (changed) {
      try {
        this.storage?.setItem(`${KEY_PREFIX}${raffleId}`, JSON.stringify(pins));
      } catch {
        // Quota or private mode: the next visit reports a first visit again.
      }
    }
  }

  /** check() then pin(): for values that need no verification first, such as the pre-sale ones. */
  observe(raffleId: string, seen: SeenValues): PinReport {
    const report = this.check(raffleId, seen);
    this.pin(raffleId, seen);
    return report;
  }

  /** The pins of a raffle, or null when there is no usable storage. */
  private read(raffleId: string): PinnedValues | null {
    if (!this.storage) {
      return null;
    }
    try {
      return parsePins(this.storage.getItem(`${KEY_PREFIX}${raffleId}`));
    } catch {
      return null;
    }
  }
}
