import React, { useEffect, useState } from 'react';
import { KeyRound, Loader2, ShieldCheck, X } from 'lucide-react';
import { prahariApi } from '../services/api';
import { getAccessToken, isTokenRejected, setSession, subscribeAccessToken } from '../services/accessToken';

/** Demo officers seeded by the backend for hackathon evaluation (see backend/auth.py). */
const DEMO_OFFICERS = [
  { username: 'inspector_alwar', rank: 'INSPECTOR', name: 'Vikram Singh Rathore', district: 'Alwar', note: 'can escalate & close' },
  { username: 'dsp_jaipur', rank: 'DSP', name: 'Ananya Sharma', district: 'Jaipur Rural', note: 'can escalate & close' },
  { username: 'constable_ganganagar', rank: 'CONSTABLE', name: 'Manish Meena', district: 'Sri Ganganagar', note: 'triage only' },
] as const;
const DEMO_PASSWORD = 'Prahari@2026';

const label = 'block font-mono text-[10px] tracking-[0.14em] text-slate-400 mb-1';
const field =
  'w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 font-mono text-[13px] text-slate-100 placeholder:text-slate-600 focus:border-[#00E5FF]/60 focus:outline-none focus:ring-1 focus:ring-[#00E5FF]/30';

/**
 * Officer Authentication modal. Shown when nobody is signed in or the backend rejected the saved session (401).
 * "Not now" shrinks it to a small pill at the top so the landing page stays usable.
 */
export const AccessTokenGate: React.FC = () => {
  const [, force] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [serviceToken, setServiceToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => subscribeAccessToken(() => force((n) => n + 1)), []);

  const signedIn = !!getAccessToken() && !isTokenRejected();
  if (signedIn) return null;

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={() => setDismissed(false)}
        className="fixed top-3 left-1/2 z-[9999] -translate-x-1/2 flex items-center gap-2 rounded-full border border-[#00E5FF]/40 bg-[#080808]/95 px-3 py-1.5 font-mono text-[10px] tracking-wider text-[#00E5FF] shadow-[0_0_20px_rgba(0,229,255,0.15)] backdrop-blur hover:bg-[#00E5FF]/10"
      >
        <KeyRound className="h-3.5 w-3.5" aria-hidden />
        OFFICER SIGN-IN REQUIRED · SIGN IN
      </button>
    );
  }

  const finish = () => window.location.reload(); // every panel and the live stream reconnect with the new session

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (legacy) {
        const token = serviceToken.trim();
        const officer = token ? await prahariApi.me(token) : null;
        if (!officer) throw new Error('That service token was not accepted by the backend.');
        setSession(token, officer);
      } else {
        const { accessToken, officer } = await prahariApi.login(username.trim(), password);
        setSession(accessToken, officer);
      }
      finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="officer-auth-title">
      <form
        onSubmit={submit}
        autoComplete="off"
        className="relative w-full max-w-[440px] rounded-xl border border-[#00E5FF]/25 bg-[#080808] p-5 text-slate-200 shadow-[0_0_60px_rgba(0,229,255,0.12)]"
      >
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute right-3 top-3 rounded p-1 text-slate-500 hover:text-slate-200"
          aria-label="Not now"
          title="Not now (live data needs a sign-in)"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#00E5FF]/40 bg-[#00E5FF]/10">
            <ShieldCheck className="h-5 w-5 text-[#00E5FF]" aria-hidden />
          </div>
          <div>
            <h2 id="officer-auth-title" className="font-mono text-[13px] font-bold tracking-[0.16em] text-white">
              OFFICER AUTHENTICATION
            </h2>
            <p className="font-mono text-[10px] text-slate-500">
              {isTokenRejected() ? 'Session expired or rejected. Sign in again.' : 'PRAHARI // Rajasthan Police cyber OSINT console'}
            </p>
          </div>
        </div>

        {!legacy ? (
          <>
            <label htmlFor="officer-username" className={label}>USERNAME</label>
            <input
              id="officer-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. inspector_alwar"
              spellCheck={false}
              autoCapitalize="none"
              autoComplete="username"
              className={field}
            />
            <label htmlFor="officer-password" className={`${label} mt-3`}>PASSWORD</label>
            <input
              id="officer-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className={field}
            />

            <div className="mt-4">
              <p className={label}>DEMO OFFICERS · ONE-CLICK FILL (PASSWORD {DEMO_PASSWORD})</p>
              <div className="grid gap-1.5">
                {DEMO_OFFICERS.map((o) => (
                  <button
                    key={o.username}
                    type="button"
                    onClick={() => {
                      setUsername(o.username);
                      setPassword(DEMO_PASSWORD);
                      setError('');
                    }}
                    className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left font-mono text-[11px] transition-colors ${
                      username === o.username ? 'border-[#00E5FF]/60 bg-[#00E5FF]/10' : 'border-white/10 hover:border-[#00E5FF]/40 hover:bg-white/[0.03]'
                    }`}
                  >
                    <span className="truncate">
                      <span className="text-[#00E5FF]">{o.rank}</span> {o.name} <span className="text-slate-500">· {o.district}</span>
                    </span>
                    <span className="shrink-0 text-[9px] text-slate-500">{o.note}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <label htmlFor="service-token" className={label}>LEGACY SERVICE TOKEN (PRAHARI_API_TOKEN)</label>
            <input
              id="service-token"
              type="password"
              value={serviceToken}
              onChange={(e) => setServiceToken(e.target.value)}
              spellCheck={false}
              data-lpignore="true"
              className={field}
            />
            <p className="mt-1.5 font-mono text-[10px] text-slate-500">
              Acts as the SYSTEM admin account. Use for automation only; officers should sign in by name.
            </p>
          </>
        )}

        {error && (
          <p className="mt-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 font-mono text-[11px] text-rose-200" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || (legacy ? !serviceToken.trim() : !username.trim() || !password)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-[#00E5FF] py-2 font-mono text-[12px] font-bold tracking-[0.14em] text-black transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {busy ? 'VERIFYING…' : 'SIGN IN'}
        </button>

        <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-slate-500">
          <button type="button" onClick={() => { setLegacy((v) => !v); setError(''); }} className="hover:text-[#00E5FF]">
            {legacy ? '← Officer sign-in' : 'Use legacy service token'}
          </button>
          <span>Session lasts 24 h · stored in this browser</span>
        </div>
      </form>
    </div>
  );
};
