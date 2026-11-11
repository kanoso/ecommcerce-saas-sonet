import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Hashes a plaintext password using scrypt with a unique random salt.
 * Format: `salt:derivedKey` (both hex-encoded).
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Verifies a password against the stored `salt:derivedKey` hash in constant time.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) {
    return false;
  }
  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }
  const [salt, keyHex] = parts;
  try {
    const keyBuffer = Buffer.from(keyHex, 'hex');
    const derivedBuffer = scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedBuffer.length) {
      return false;
    }
    return timingSafeEqual(keyBuffer, derivedBuffer);
  } catch {
    return false;
  }
}
