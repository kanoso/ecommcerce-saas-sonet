/**
 * The value of Express `trust proxy`, from TRUST_PROXY: a hop count, or a
 * comma-separated list of addresses, CIDR ranges or the names Express knows
 * (loopback, linklocal, uniquelocal). Express then derives `req.ip` from
 * X-Forwarded-For only for peers it trusts.
 *
 * `true` would trust any peer, so anyone could pick their own IP: refused.
 * Behind Cloudflare, list Cloudflare's published ranges here; the app never
 * reads CF-Connecting-IP itself.
 */
export function parseTrustProxy(raw: string): number | string {
  const value = raw.trim();
  if (!value || value === 'true' || value === '*') {
    throw new Error('TRUST_PROXY must be a hop count or a list of trusted proxies, never every peer');
  }
  return /^\d+$/.test(value) ? Number(value) : value;
}
