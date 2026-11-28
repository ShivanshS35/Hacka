import React, { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { getAccessToken, isTokenRejected, setAccessToken, subscribeAccessToken } from '../services/accessToken';

/**
 * Small bar at the top of the screen (the bottom belongs to the dock) that asks for the backend access token when none is saved
 * or when the backend rejected the saved one (HTTP 401). Hidden otherwise.
 */
export const AccessTokenGate: React.FC = () => {
  const [, force] = useState(0);
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => subscribeAccessToken(() => force((n) => n + 1)), []);

  const saved = getAccessToken();
  if (saved && !isTokenRejected()) return null;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!setAccessToken(draft)) {
      setMsg('Token must be at least 16 characters with no spaces.');
      return;
    }
    setDraft('');
    setMsg('');
    // Reload so every panel and the live stream reconnect with the token.
    window.location.reload();
  };

  return (
    <form
      onSubmit={save}
      autoComplete="off"
      className="fixed top-3 left-1/2 z-[9999] flex w-[min(640px,calc(100vw-32px))] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-[#0C101A]/95 px-3 py-2 font-mono text-[11px] text-amber-100 shadow-2xl backdrop-blur"
      role="dialog"
      aria-label="Backend access token"
    >
      <KeyRound className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
      <label htmlFor="prahari-api-token" className="shrink-0">
        {saved ? 'Access token rejected. Enter the current one:' : 'Backend access token:'}
      </label>
      <input
        id="prahari-api-token"
        type="password"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        data-lpignore="true"
        className="min-w-[160px] flex-1 rounded border border-slate-700 bg-black/40 px-2 py-1 text-slate-200 focus:border-cyan-500/50 focus:outline-none"
      />
      <button type="submit" className="rounded border border-amber-500/50 px-3 py-1 text-amber-200 hover:bg-amber-500/10">
        Save
      </button>
      <p className="w-full text-[10px] text-slate-400">
        {msg || 'Ask the person running the backend for its PRAHARI_API_TOKEN. Stored only in this browser.'}
      </p>
    </form>
  );
};
