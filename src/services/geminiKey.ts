/**
 * User-supplied Gemini API key. Stored only in this browser (localStorage) and sent to the
 * Prahari backend in an `X-Gemini-Key` header on Gemini-powered requests. Never bundled,
 * never hardcoded, never logged. Changes only when the user saves or clears it.
 */
const STORAGE_KEY = 'prahari.geminiApiKey';
const listeners = new Set<() => void>();

export function getGeminiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/** Same shape rules as the backend: a real key is one token of 10-200 characters with no spaces. */
export function isPlausibleKey(key: string): boolean {
  const clean = key.trim();
  return clean.length >= 10 && clean.length <= 200 && !/\s/.test(clean);
}

export function setGeminiKey(key: string): boolean {
  try {
    const clean = key.trim();
    if (!isPlausibleKey(clean)) return false;
    localStorage.setItem(STORAGE_KEY, clean);
    listeners.forEach((l) => l());
    return true;
  } catch {
    return false;
  }
}

export function clearGeminiKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export function maskKey(key: string): string {
  return key.length > 4 ? `••••••••${key.slice(-4)}` : '••••';
}

export function subscribeGeminiKey(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Headers for any request that may use Gemini. Empty when no key is saved. */
export function geminiHeaders(): Record<string, string> {
  const key = getGeminiKey();
  return key ? { 'X-Gemini-Key': key } : {};
}
