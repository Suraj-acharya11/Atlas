import { isJwtExpired } from '../lib/auth-token';

describe('JWT session validation', () => {
  const header = 'eyJhbGciOiJub25lIn0';
  const payload = (expiration: number) => Buffer.from(JSON.stringify({ exp: expiration })).toString('base64url');

  it('rejects expired tokens', () => {
    expect(isJwtExpired(`${header}.${payload(100)}.signature`, 101000)).toBe(true);
  });

  it('accepts tokens that have not expired', () => {
    expect(isJwtExpired(`${header}.${payload(200)}.signature`, 101000)).toBe(false);
  });

  it('treats malformed tokens as invalid', () => {
    expect(isJwtExpired('not-a-jwt', 101000)).toBe(true);
  });
});
