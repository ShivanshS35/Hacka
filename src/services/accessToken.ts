/**
 * Backend access token (the server's PRAHARI_API_TOKEN). Typed in by the analyst and stored only in this
 * browser (localStorage), like the Gemini key. It is never baked into the build, so it is not exposed to
 * everyone who loads the site. It is one shared token, not a per-user login.
 */
const STORAGE_KEY = 'prahari.apiToken';
const listeners = new Set<() => void>();
let rejected = false;

export function getAccessToken(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setAccessToken(token: string): boolean {
  const clean = token.trim();
  if (clean.length < 16 || /\s/.test(clean)) return false;
  try {
    localStorage.setItem(STORAGE_KEY, clean);
  } catch {
    return false;
  }
  rejected = false;
  listeners.forEach((l) => l());
  return true;
}

export function clearAccessToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

/** True after the backend answered 401 to the saved token (or to no token). */
export function isTokenRejected(): boolean {
  return rejected;
}

/** Called by the API client on any 401 so the UI can ask for a (new) token. */
export function markTokenRejected(): void {
  if (!rejected) {
    rejected = true;
    listeners.forEach((l) => l());
  }
}

export function subscribeAccessToken(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Authorization header for every protected /api request. Empty when no token is saved. */
export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
