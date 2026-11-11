import { DrandFetch, DrandResponse } from './drand-client';

/** Round 1000000 of quicknet as api.drand.sh served it (also in the API's beacon spec). */
export const ROUND_1M = {
  round: 1000000,
  randomness: 'b22aad4794f7451896f7a371aa46106fd84d919f3f569acd5b2fddf1d1440af3',
  signature:
    '83ad29e4c409f9470fc2ef02f90214df49e02b441a1a241a82d622d9f608ef98fd8b11a029f1bee9d9e83b45088abe72',
};

/** What one relay does for one request. */
export type RelayAnswer = { status: number; body?: unknown } | 'network-error' | 'hang';

/**
 * A fake of the relays: answers by URL, in order when a URL has a list,
 * and records every URL asked. An unknown URL answers 404.
 */
export function fakeDrand(answers: Record<string, RelayAnswer | RelayAnswer[]>): {
  fetch: DrandFetch;
  calls: string[];
} {
  const calls: string[] = [];
  const fetch: DrandFetch = (url, init) => {
    calls.push(url);
    const entry = answers[url];
    const answer = Array.isArray(entry) ? (entry.length > 1 ? entry.shift() : entry[0]) : entry;
    if (answer === undefined) {
      return Promise.resolve(response(404, {}));
    }
    if (answer === 'network-error') {
      return Promise.reject(new TypeError('Failed to fetch'));
    }
    if (answer === 'hang') {
      return new Promise((_, reject) =>
        init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
      );
    }
    return Promise.resolve(response(answer.status, answer.body));
  };
  return { fetch, calls };
}

function response(status: number, body: unknown): DrandResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
