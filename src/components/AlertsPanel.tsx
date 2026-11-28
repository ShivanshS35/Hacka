import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, Copy, Check, Link2, RefreshCw, ShieldAlert, Download, ScrollText, Image as ImageIcon } from 'lucide-react';
import { prahariApi, getAnalystName, setAnalystName } from '../services/api';
import { AnalystStatus, AuditChainStatus, AuditEntry, ComplaintSummary, CoordinatedGroup, InterceptPost, ThreatAlert } from '../types';
import { DirectionBadge, PlatformBadge, STATUSES, STATUS_LABEL } from './MetaBadges';

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
  const [statusFilter, setStatusFilter] = useState<'ALL' | AnalystStatus>('ALL');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [analyst, setAnalyst] = useState(getAnalystName());
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [chain, setChain] = useState<AuditChainStatus | null>(null);
  const [complaintSummary, setComplaintSummary] = useState<ComplaintSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, g, au, ch, cs] = await Promise.all([
      prahariApi.getAlerts(),
      prahariApi.getCoordinated(),
      prahariApi.getAudit(6),
      prahariApi.verifyAuditChain(),
      prahariApi.getComplaintSummary(),
    ]);
    setComplaintSummary(cs);
    setOffline(a === null);
    setAlerts(a);
    setGroups(g);
    setAudit(au);
    setChain(ch);
    setLoading(false);
  }, []);

  const changeStatus = async (a: ThreatAlert, status: AnalystStatus) => {
    setSaving(a.postId);
    const ok = await prahariApi.setStatus(a.postId, status, notes[a.postId] ?? a.analystNote ?? '');
    setSaving(null);
    if (ok) await load();
  };

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

  const shown = (alerts ?? []).filter(
    (a) => (risk === 'ALL' || a.riskLevel === risk) && (statusFilter === 'ALL' || (a.analystStatus ?? 'NEW') === statusFilter)
  );
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | AnalystStatus)}
              title="Filter by analyst status"
              className="bg-[#070A10] border border-white/10 rounded px-1.5 py-0.5 text-slate-300 focus:outline-none"
            >
              <option value="ALL">ANY STATUS</option>
              {STATUSES.map((st) => (
                <option key={st} value={st}>{STATUS_LABEL[st].text}</option>
              ))}
            </select>
            {(['csv', 'json'] as const).map((f) => (
              <a
                key={f}
                href={prahariApi.exportUrl(f, { risk, status: statusFilter })}
                title={`Download the ${shown.length} alerts matching these filters as ${f.toUpperCase()} (also written to the audit log)`}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/10 text-slate-400 hover:text-white"
              >
                <Download className="w-3 h-3" />{f.toUpperCase()}
              </a>
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

        <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-[calc(var(--dock-clearance,0px)+12px)] space-y-2.5">
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
                <PlatformBadge platform={a.platform} />
                <DirectionBadge direction={a.direction} />
                {a.image && (
                  <span title={`Image ${a.image.sha256.slice(0, 12)}…, ${a.image.width}×${a.image.height}`} className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/10 text-slate-300 text-[9px]">
                    <ImageIcon className="w-3 h-3" />IMAGE
                  </span>
                )}
                {!!a.complaintCount && (
                  <span
                    title="An identifier in this post also appears in uploaded cybercrime complaints"
                    className="px-1.5 py-0.5 rounded border border-rose-500/40 bg-rose-500/15 text-rose-200 text-[9px] font-semibold"
                  >
                    IN {a.complaintCount} COMPLAINT{a.complaintCount > 1 ? 'S' : ''}
                  </span>
                )}
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
              {!!a.complaintMatches?.length && (
                <ul className="mt-1.5 space-y-0.5 text-[10px] font-mono text-rose-200/80">
                  {a.complaintMatches.map((m) => (
                    <li key={m.ackNo}>
                      Complaint {m.ackNo} · {m.districtId} · {m.subCategory || m.category} · {m.reportedOn.slice(0, 10)}
                      <span className="text-slate-500"> (matched {m.matchedOn.replace(/^\w+:/, '')})</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                <span className="text-slate-500">STATUS</span>
                {STATUSES.map((st) => {
                  const active = (a.analystStatus ?? 'NEW') === st;
                  return (
                    <button
                      key={st}
                      disabled={saving === a.postId}
                      onClick={() => !active && changeStatus(a, st)}
                      className={`px-1.5 py-0.5 rounded border transition-colors ${
                        active ? STATUS_LABEL[st].cls : 'text-slate-500 border-white/10 hover:text-white'
                      }`}
                    >
                      {STATUS_LABEL[st].text}
                    </button>
                  );
                })}
                <input
                  value={notes[a.postId] ?? a.analystNote ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [a.postId]: e.target.value }))}
                  onBlur={() => {
                    const draft = notes[a.postId];
                    if (draft !== undefined && draft !== (a.analystNote ?? '')) changeStatus(a, a.analystStatus ?? 'NEW');
                  }}
                  maxLength={500}
                  placeholder="note (saved when you click away)"
                  className="flex-1 min-w-[140px] bg-[#070A10] border border-white/10 rounded px-2 py-0.5 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                />
              </div>
              {a.statusUpdatedAt && (
                <p className="mt-1 text-[10px] text-slate-600 font-mono">
                  last changed by {a.statusActor} · {new Date(a.statusUpdatedAt).toLocaleString('en-IN')}
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
        <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-[calc(var(--dock-clearance,0px)+12px)] space-y-2.5">
          {complaintSummary && complaintSummary.complaints > 0 && (
            <div className="rounded-lg border border-rose-500/25 bg-rose-500/[0.06] p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-300" />
                <h3 className="text-xs font-semibold text-rose-100">Complaint cross-check</h3>
                <span className="ml-auto text-[10px] font-mono text-slate-400">{complaintSummary.complaints} complaints</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">
                <b className="text-white">{complaintSummary.postsMatched ?? 0}</b> of {complaintSummary.postsChecked ?? 0} posts share an
                identifier with a complaint. {complaintSummary.repeatIdentifierCount} suspect identifiers appear in 2+ complaints.
              </p>
              <p className="text-[10px] font-mono text-slate-400 leading-snug">
                Mentions: {Object.entries(complaintSummary.topics).map(([k, v]) => `${k.replace('_', ' ')} ${v}`).join(' · ')}
              </p>
              <p className="text-[10px] font-mono text-slate-400 leading-snug">
                Top districts: {Object.entries(complaintSummary.byDistrict).filter(([k]) => k !== 'unknown').slice(0, 4).map(([k, v]) => `${k} ${v}`).join(' · ')}
              </p>
              <p className="text-[9px] text-slate-500 leading-snug">{complaintSummary.note}</p>
            </div>
          )}
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
        <div className="shrink-0 border-t border-white/[0.07] p-3 space-y-2">
          <div className="flex items-center gap-2">
            <ScrollText className="w-3.5 h-3.5 text-cyan-400" />
            <h3 className="text-xs font-semibold">Audit trail</h3>
            {chain && (
              <span
                className={`ml-auto px-1.5 py-0.5 rounded border text-[9px] font-mono ${
                  chain.ok ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-rose-300 border-rose-500/30 bg-rose-500/10'
                }`}
                title="Each entry stores a hash of the one before it. A broken chain means an old entry was edited or removed. It does not authenticate who made an entry."
              >
                {chain.ok ? `CHAIN OK · ${chain.entries}` : `CHAIN BROKEN AT #${chain.brokenAtId}`}
              </span>
            )}
          </div>
          <label className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
            LOGGED AS
            <input
              value={analyst}
              onChange={(e) => setAnalyst(e.target.value)}
              onBlur={() => setAnalystName(analyst)}
              maxLength={64}
              className="flex-1 bg-[#070A10] border border-white/10 rounded px-2 py-0.5 text-slate-300 focus:outline-none focus:border-cyan-500/40"
            />
          </label>
          <ul className="space-y-1 max-h-28 overflow-y-auto">
            {(audit ?? []).map((e) => (
              <li key={e.id} className="text-[10px] font-mono text-slate-400 leading-snug">
                <span className="text-slate-600">{new Date(e.ts).toLocaleTimeString('en-IN')}</span>{' '}
                <span className="text-cyan-300">{e.action}</span> {e.postId ?? ''} <span className="text-slate-500">by {e.actor}</span>
              </li>
            ))}
            {audit && audit.length === 0 && <li className="text-[10px] text-slate-600">No entries yet.</li>}
          </ul>
          <p className="text-[9px] text-slate-600 leading-snug">
            The name above is typed in by the user; the prototype has no logins, so entries show who said they acted, not who did.
          </p>
        </div>
      </section>
    </div>
  );
};
