import { hashPassword, verifyPassword } from './password.util';

describe('password.util', () => {
  it('hashes and successfully verifies a correct password', () => {
    const hash = hashPassword('MiClaveSegura123!');
    expect(hash).toContain(':');
    expect(verifyPassword('MiClaveSegura123!', hash)).toBe(true);
  });

  it('rejects an incorrect password', () => {
    const hash = hashPassword('MiClaveSegura123!');
    expect(verifyPassword('OtraClave123!', hash)).toBe(false);
  });

  it('generates different salts for identical passwords', () => {
    const hash1 = hashPassword('password123');
    const hash2 = hashPassword('password123');
    expect(hash1).not.toBe(hash2);
    expect(verifyPassword('password123', hash1)).toBe(true);
    expect(verifyPassword('password123', hash2)).toBe(true);
  });

  it('returns false for malformed hashes', () => {
    expect(verifyPassword('password', '')).toBe(false);
    expect(verifyPassword('password', 'not-a-valid-hash')).toBe(false);
  });
});
