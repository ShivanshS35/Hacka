import React, { useEffect, useState } from 'react';
import { prahariApi } from '../services/api';
import { getGeminiKey, setGeminiKey, clearGeminiKey, maskKey, subscribeGeminiKey } from '../services/geminiKey';

function describeStatus(s?: string): string {
  if (!s) return 'unknown error';
  if (s === 'http_429') return 'rate limit or quota reached — wait a minute';
  if (s === 'http_403' || s === 'http_401') return 'key not allowed to use this model';
  if (s === 'http_404') return 'no usable model found for this key';
  if (s === 'timeout') return 'Gemini took too long to answer';
  if (s === 'network') return 'network error';
  if (s === 'budget') return 'call limit reached';
  if (s === 'bad_reply') return 'unreadable reply';
  return s;
}

/** Discreet Gemini API key settings. Collapsed by default; sits at the very bottom of the first page. */
export const ApiKeyConfig: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(getGeminiKey());
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeGeminiKey(() => setSaved(getGeminiKey())), []);

  const save = () => {
    if (!setGeminiKey(draft)) {
      setMsg('Enter a key to save.');
      return;
    }
    setDraft('');
    setMsg('Saved in this browser.');
  };

  const test = async () => {
    setBusy(true);
    setMsg('Checking…');
    const r = await prahariApi.checkGeminiKey();
    if (!r.valid) setMsg(r.reason);
    else if (!r.generation) setMsg('Key accepted, but the backend is an older version (redeploy needed).');
    else if (r.generation.ok) setMsg(`Key works. AI classified the test post as ${r.generation.sample} (${r.generation.model}).`);
    else {
      const g = r.generation;
      const tried = g.tried?.length ? ` Tried: ${g.tried.join(', ')}.` : '';
      const avail = g.available?.length ? ` Models on this key: ${g.available.join(', ')}.` : '';
      setMsg(`Key accepted but the AI call failed (${describeStatus(g.status)}).${tried}${avail}`);
    }
    setBusy(false);
  };

  const remove = () => {
    clearGeminiKey();
    setMsg('Key removed.');
  };

  return (
    <div className="w-full pb-4 pt-2 text-center font-mono text-[10px] text-slate-600">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="opacity-40 hover:opacity-100 transition-opacity underline-offset-2 hover:underline"
        aria-expanded={open}
      >
        {open ? 'hide AI settings' : saved ? 'AI settings · key saved' : 'AI settings'}
      </button>

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="mx-auto mt-3 flex max-w-md flex-col items-center gap-2"
          autoComplete="off"
        >
          <label htmlFor="gemini-key" className="text-slate-500">
            Gemini API Key
          </label>
          <input
            id="gemini-key"
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={saved ? `Current: ${maskKey(saved)} — paste a new key to replace` : ''}
            spellCheck={false}
            autoComplete="off"
            data-lpignore="true"
            className="w-full rounded-md border border-slate-800 bg-black/40 px-3 py-1.5 text-slate-300 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
          />
          <div className="flex gap-2">
            <button type="submit" className="rounded border border-slate-700 px-3 py-1 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300">
              Save
            </button>
            <button
              type="button"
              onClick={test}
              disabled={!saved || busy}
              className="rounded border border-slate-800 px-3 py-1 text-slate-400 hover:border-cyan-500/50 disabled:opacity-40"
            >
              Test
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={!saved}
              className="rounded border border-slate-800 px-3 py-1 text-slate-400 hover:border-red-500/50 disabled:opacity-40"
            >
              Remove
            </button>
          </div>
          <p className="min-h-[1em] text-slate-500" role="status">{msg}</p>
          <p className="text-[9px] text-slate-700">
            Stored only in this browser and sent to the Prahari backend with AI requests. Never shared or logged.
          </p>
        </form>
      )}
    </div>
  );
};
