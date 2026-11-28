import React from 'react';
import { ExtractedEntities } from '../types';

type Kind = 'upi' | 'phone' | 'wallet' | 'bank' | 'handle' | 'slang';

const KIND_CLASS: Record<Kind, string> = {
  upi: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
  phone: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  wallet: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
  bank: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  handle: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  slang: '',
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Highlighting is capped so a pathological (very long) post can never stall rendering.
const MAX_HIGHLIGHT_CHARS = 5000;

/**
 * Renders post text with colour-coded badges for the identifiers the backend already extracted
 * (UPI, phone, wallet, bank/IFSC, @handle) and red matched-slang terms.
 * It matches the literal extracted strings (no identifier regexes), so it is linear-time and
 * always agrees with what the extractor reported.
 */
export function renderHighlightedText(
  text: string,
  matchedSlang: string[] = [],
  entities?: Partial<ExtractedEntities>
): React.ReactNode {
  if (!text) return text;
  if (text.length > MAX_HIGHLIGHT_CHARS) return text;

  const tokens = new Map<string, Kind>();
  const add = (list: string[] | undefined, kind: Kind) =>
    (list || []).forEach((t) => {
      const v = (t || '').trim();
      if (v.length >= 3 && !tokens.has(v.toLowerCase())) tokens.set(v.toLowerCase(), kind);
    });

  // Order = priority when the same string appears in two lists (UPI before @handle, etc.).
  add(entities?.upis, 'upi');
  add(entities?.wallets, 'wallet');
  add(entities?.phones, 'phone');
  add(entities?.bankAccounts, 'bank');
  add(entities?.ifscCodes, 'bank');
  add(entities?.handles, 'handle');
  add(matchedSlang, 'slang');
  if (tokens.size === 0) return text;

  // Longest first so "raj.pay@oksbi" wins over the "@oksbi" substring or a shorter slang term.
  const alternation = [...tokens.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escapeRe)
    .join('|');
  const re = new RegExp(`(${alternation})`, 'gi');

  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const kind = tokens.get(m[0].toLowerCase()) || 'slang';
    nodes.push(
      kind === 'slang' ? (
        <span key={`s${key++}`} className="text-rose-400 font-medium tracking-tight">
          {m[0]}
        </span>
      ) : (
        <span
          key={`i${key++}`}
          className={`inline-block max-w-full break-all px-1 mx-0.5 rounded font-mono text-[11px] border ${KIND_CLASS[kind]}`}
        >
          {m[0]}
        </span>
      )
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** "28 NOV 2026 · 13:04 IST" — always shown in India Standard Time with the zone named. */
export function formatIST(timestamp?: string, withYear = true): string {
  const d = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(d.getTime())) return timestamp || 'just now';
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return `${g('day')} ${g('month').toUpperCase()}${withYear ? ' ' + g('year') : ''} · ${g('hour')}:${g('minute')} IST`;
}
