import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Rate limits by `req.ip` only. Express derives it from X-Forwarded-For for
 * the proxies TRUST_PROXY names, so a header sent by a client is ignored
 * unless it came through a trusted proxy. Headers are never read here: a raw
 * CF-Connecting-IP or X-Forwarded-For can be forged by anyone.
 *
 * Unlike tiendi-api, the limits stay on in tests: they are part of the
 * contract, and the e2e suite checks them.
 *
 * The counters live in this process. With several replicas each keeps its
 * own: the real limit is the configured one times the replicas.
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    return (req as unknown as Request).ip ?? 'unknown';
  }
}
