import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, Copy, Check, Link2, RefreshCw, ShieldAlert } from 'lucide-react';
import { prahariApi } from '../services/api';
import { CoordinatedGroup, InterceptPost, ThreatAlert } from '../types';

interface AlertsPanelProps {
  posts: InterceptPost[];
  /** Changes whenever a new post arrives, so the panel re-fetches. */
  refreshKey: number;
  onOpenPost: (postId: string) => void;
}

const RISK_STYLE: Record<ThreatAlert['riskLevel'], string> = {
  HIGH: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
  MEDIUM: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  LOW: 'text-slate-300 bg-white/[0.04] border-white/10',
};

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ posts, refreshKey, onOpenPost }) => {
  const [alerts, setAlerts] = useState<ThreatAlert[] | null>(null);
  const [groups, setGroups] = useState<CoordinatedGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [risk, setRisk] = useState<'ALL' | ThreatAlert['riskLevel']>('ALL');
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, g] = await Promise.all([prahariApi.getAlerts(), prahariApi.getCoordinated()]);
    setOffline(a === null);
    setAlerts(a);
    setGroups(g);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const copyHash = (hash: string) => {
    try {
      navigator.clipboard.writeText(hash);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(hash);
    setTimeout(() => setCopied(null), 1500);
  };

  const shown = (alerts ?? []).filter((a) => risk === 'ALL' || a.riskLevel === risk);
  const textFor = (id: string) => posts.find((p) => p.id === id)?.rawText ?? '';

  return (
    <div className="w-full h-full grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 overflow-hidden bg-[#070A10]">
      {/* ALERTS */}
      <section className="lg:col-span-8 min-h-0 flex flex-col rounded-xl border border-white/[0.07] bg-[#0C101A]">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.07]">
          <div className="flex items-center gap-2 min-w-0">
            <BellRing className="w-4 h-4 text-rose-400 shrink-0" />
            <h2 className="text-sm font-semibold tracking-tight">Alerts</h2>
            <span className="text-[11px] font-mono text-slate-500">{shown.length} shown</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRisk(r)}
                className={`px-2 py-0.5 rounded border transition-colors ${
                  risk === r
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                    : 'text-slate-400 border-white/10 hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
            <button
              onClick={load}
              title="Refresh"
              className="p-1 rounded border border-white/10 text-slate-400 hover:text-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
          {offline && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs p-3">
              The analysis backend is not reachable (a free instance can take about a minute to wake up).
              Alerts come from the backend, so nothing is shown until it responds. Use refresh to retry.
            </div>
          )}
          {!offline && !loading && shown.length === 0 && (
            <div className="text-xs text-slate-500 p-3">No alerts at this risk level yet.</div>
          )}
          {shown.map((a) => (
            <article key={a.alertId + a.postId} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                <span className={`px-2 py-0.5 rounded border ${RISK_STYLE[a.riskLevel]}`}>
                  {a.riskLevel} · {a.riskScore}
                </span>
                <span className="text-cyan-300">{a.alertId}</span>
                <span className="text-slate-400">{a.channel}</span>
                {a.districtId !== 'unknown' && <span className="text-slate-500">· {a.districtId}</span>}
                <span className="ml-auto text-slate-400">{Math.round(a.confidence * 100)}% match</span>
              </div>
              <p className="mt-2 text-[13px] leading-snug text-slate-200 break-words">{a.evidence.text}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-mono">
                {a.categories.map((c) => (
                  <span key={c} className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                    {c}
                  </span>
                ))}
                {[...a.entities.upis, ...a.entities.phones, ...a.entities.handles].map((id) => (
                  <span key={id} className="px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-300 border border-white/10">
                    {id}
                  </span>
                ))}
              </div>
              {a.riskReasons.length > 0 && (
                <p className="mt-2 text-[11px] text-slate-500">
                  Why: {a.riskReasons.join(' · ')}
                </p>
              )}
              <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-mono text-slate-500">
                <button
                  onClick={() => copyHash(a.evidence.sha256)}
                  className="flex items-center gap-1 hover:text-cyan-300 truncate"
                  title={`SHA-256 of ${a.evidence.sha256Scope}. A content digest, not a legal certificate.`}
                >
                  {copied === a.evidence.sha256 ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span className="truncate">SHA-256 {a.evidence.sha256.slice(0, 20)}…</span>
                </button>
                <button onClick={() => onOpenPost(a.postId)} className="text-cyan-400 hover:text-cyan-300 shrink-0">
                  Open dossier →
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* COORDINATED ADS */}
      <section className="lg:col-span-4 min-h-0 flex flex-col rounded-xl border border-white/[0.07] bg-[#0C101A]">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.07]">
          <Link2 className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold tracking-tight">Coordinated ads</h2>
          <span className="text-[11px] font-mono text-slate-500">{groups?.length ?? 0} groups</span>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
          <p className="text-[11px] text-slate-500 leading-snug">
            Posts whose wording is almost identical (character n-gram TF-IDF similarity), even when the spelling
            varies. Cross-channel groups are the strongest signal of one operator posting in several places.
          </p>
          {!offline && !loading && (groups?.length ?? 0) === 0 && (
            <div className="text-xs text-slate-500">No near-duplicate ads found yet.</div>
          )}
          {(groups ?? []).map((g, i) => (
            <div key={i} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 text-[11px]">
              <div className="flex flex-wrap items-center gap-2 font-mono">
                {g.crossChannel && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/25">
                    <ShieldAlert className="w-3 h-3" /> CROSS-CHANNEL
                  </span>
                )}
                <span className="text-slate-300">{g.size} posts</span>
                <span className="text-cyan-300 ml-auto">{Math.round(g.maxSimilarity * 100)}% similar</span>
              </div>
              <div className="mt-1.5 text-slate-400 font-mono break-words">{g.channels.join(' · ')}</div>
              <ul className="mt-2 space-y-1">
                {g.postIds.slice(0, 3).map((id) => (
                  <li key={id}>
                    <button
                      onClick={() => onOpenPost(id)}
                      className="text-left text-slate-300 hover:text-cyan-300 line-clamp-2 break-words"
                    >
                      “{textFor(id) || id}”
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
