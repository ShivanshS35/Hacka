/**
 * Officer session. After login the backend returns a signed access token (JWT, 24 h) and the officer's profile.
 * Both are kept only in this browser's localStorage: `prahari.apiToken` and `prahari.officer`.
 * The legacy shared service token (PRAHARI_API_TOKEN) can still be used; the backend treats it as a SYSTEM admin.
 * Nothing is baked into the build.
 */
const TOKEN_KEY = 'prahari.apiToken';
const OFFICER_KEY = 'prahari.officer';
const listeners = new Set<() => void>();
let rejected = false;

export type OfficerRank = 'CONSTABLE' | 'INSPECTOR' | 'DSP' | 'ADMIN';

export interface OfficerProfile {
  username: string;
  fullName: string;
  badgeNumber: string;
  rank: OfficerRank;
  district: string;
  policeStation: string;
  isServiceAccount: boolean;
}

const RANK_LEVEL: Record<OfficerRank, number> = { CONSTABLE: 0, INSPECTOR: 1, DSP: 2, ADMIN: 3 };

/** Statuses that need at least this rank (mirrors STATUS_MIN_RANK on the backend). */
export const STATUS_MIN_RANK: Partial<Record<string, OfficerRank>> = { ESCALATED: 'INSPECTOR', CLOSED: 'INSPECTOR' };

function notify(): void {
  listeners.forEach((l) => l());
}

export function getAccessToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function getOfficer(): OfficerProfile | null {
  try {
    const raw = localStorage.getItem(OFFICER_KEY);
    return raw ? (JSON.parse(raw) as OfficerProfile) : null;
  } catch {
    return null;
  }
}

/** Save a successful login (token + profile) and tell every listener. */
export function setSession(token: string, officer: OfficerProfile): boolean {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(OFFICER_KEY, JSON.stringify(officer));
  } catch {
    return false;
  }
  rejected = false;
  notify();
  return true;
}

/** Log out: forget the token and profile. */
export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(OFFICER_KEY);
  } catch {
    /* storage unavailable */
  }
  notify();
}

/** Kept for older callers: same as clearSession(). */
export const clearAccessToken = clearSession;

/** True when this officer may perform an action that needs `minimum` rank. */
export function hasRank(officer: OfficerProfile | null, minimum: OfficerRank): boolean {
  return !!officer && RANK_LEVEL[officer.rank] >= RANK_LEVEL[minimum];
}

/** The badge line shown in the UI, e.g. "INSPECTOR Vikram Singh Rathore [RJ-CY-4412] • Alwar". */
export function officerLabel(o: OfficerProfile): string {
  return `${o.rank} ${o.fullName} [${o.badgeNumber}] • ${o.district}`;
}

/** True after the backend answered 401 to the saved token (or to no token). */
export function isTokenRejected(): boolean {
  return rejected;
}

/** Called by the API client on any 401 so the UI can ask the officer to sign in again. */
export function markTokenRejected(): void {
  if (!rejected) {
    rejected = true;
    notify();
  }
}

export function subscribeAccessToken(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Authorization header for every protected /api request. Empty when signed out. */
export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
