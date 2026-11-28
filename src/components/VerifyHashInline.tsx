import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { prahariApi } from '../services/api';
import { VerifyResult } from '../types';
import { sound } from '../utils/audio';

type State = { s: 'busy' } | { s: 'ok'; r: VerifyResult } | { s: 'missing' } | { s: 'offline' } | null;

/** Re-hashes the text the backend has stored and compares it with the digest recorded at capture. */
export const VerifyHashInline: React.FC<{ postId: string }> = ({ postId }) => {
  const [state, setState] = useState<State>(null);
  useEffect(() => setState(null), [postId]);

  const run = async () => {
    sound.playClick();
    setState({ s: 'busy' });
    const out = await prahariApi.verifyHash(postId);
    setState(out.status === 'ok' && out.result ? { s: 'ok', r: out.result } : { s: out.status === 'not_found' ? 'missing' : 'offline' });
  };

  return (
    <div className="space-y-1.5">
      <button
        onClick={run}
        disabled={state?.s === 'busy'}
        title="Re-hash the text stored on the server right now and compare it with the digest recorded at capture"
        className="w-full flex items-center justify-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-60 border border-white/[0.08] text-slate-300 hover:text-white py-2 rounded-lg text-xs font-medium transition-colors"
      >
        <ShieldCheck className="w-3 h-3" />
        <span>{state?.s === 'busy' ? 'Checking…' : 'Re-verify hash on server'}</span>
      </button>
      {state && state.s !== 'busy' && (
        <div
          className={`p-2 rounded-lg border text-[10px] leading-snug ${
            state.s === 'ok' && state.r.match
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : state.s === 'ok'
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
          }`}
        >
          {state.s === 'ok' && state.r.match && (
            <>MATCH: the stored text still hashes to the recorded digest. It was not changed since capture; this does not show who captured it or when.</>
          )}
          {state.s === 'ok' && !state.r.match && <>MISMATCH: the stored text no longer hashes to the recorded digest. Treat this record as altered.</>}
          {state.s === 'missing' && <>Not on the server: a local sample record has no stored copy to check.</>}
          {state.s === 'offline' && <>Backend not reachable (a free instance can take about a minute to wake up). Try again.</>}
        </div>
      )}
    </div>
  );
};
