function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  if (typeof globalThis.atob !== 'function') throw new Error('JWT decoding is unavailable');
  return globalThis.atob(normalized);
}

export function isJwtExpired(token: string, now = Date.now()) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return true;
    const binary = decodeBase64Url(payload);
    const json = decodeURIComponent(Array.from(binary, (character) => `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''));
    const expiration = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof expiration !== 'number' || expiration * 1000 <= now;
  } catch {
    return true;
  }
}
