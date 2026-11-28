import React from 'react';
import { AnalystStatus, Direction, Platform } from '../types';

const PLATFORM_LABEL: Record<Platform, string> = {
  TELEGRAM: 'Telegram', WHATSAPP: 'WhatsApp', INSTAGRAM: 'Instagram', FACEBOOK: 'Facebook',
  X: 'X', OLX: 'OLX', QUIKR: 'Quikr', OTHER: 'Other', UNKNOWN: 'Platform ?',
};

export const PLATFORMS: Platform[] = ['UNKNOWN', 'TELEGRAM', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'X', 'OLX', 'QUIKR', 'OTHER'];

const DIRECTION_LABEL: Record<Direction, { text: string; cls: string; title: string }> = {
  SELL: { text: 'SELLING', cls: 'text-rose-300 bg-rose-500/10 border-rose-500/25', title: 'The post reads like an offer to sell or supply' },
  BUY: { text: 'BUYING', cls: 'text-sky-300 bg-sky-500/10 border-sky-500/25', title: 'The post reads like a request to buy' },
  RENT_OFFER: { text: 'RENT OFFERED', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/25', title: 'Something is offered for rent' },
  RENT_WANTED: { text: 'RENT WANTED', cls: 'text-violet-300 bg-violet-500/10 border-violet-500/25', title: 'Someone is looking to rent' },
  UNKNOWN: { text: '', cls: '', title: '' },
};

export const STATUS_LABEL: Record<AnalystStatus, { text: string; cls: string }> = {
  NEW: { text: 'NEW', cls: 'text-slate-300 bg-white/[0.04] border-white/10' },
  REVIEWING: { text: 'REVIEWING', cls: 'text-sky-300 bg-sky-500/10 border-sky-500/30' },
  ESCALATED: { text: 'ESCALATED', cls: 'text-rose-300 bg-rose-500/10 border-rose-500/30' },
  FALSE_POSITIVE: { text: 'FALSE POSITIVE', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  CLOSED: { text: 'CLOSED', cls: 'text-slate-400 bg-white/[0.03] border-white/10' },
};

export const STATUSES: AnalystStatus[] = ['NEW', 'REVIEWING', 'ESCALATED', 'FALSE_POSITIVE', 'CLOSED'];

const base = 'px-1.5 py-0.5 rounded border text-[9px] font-mono font-semibold whitespace-nowrap';

export const PlatformBadge: React.FC<{ platform?: Platform }> = ({ platform }) => {
  if (!platform || platform === 'UNKNOWN') return null;
  return <span className={`${base} text-slate-300 bg-white/[0.04] border-white/10`}>{PLATFORM_LABEL[platform].toUpperCase()}</span>;
};

export const DirectionBadge: React.FC<{ direction?: Direction }> = ({ direction }) => {
  if (!direction || direction === 'UNKNOWN') return null;
  const d = DIRECTION_LABEL[direction];
  return <span title={d.title} className={`${base} ${d.cls}`}>{d.text}</span>;
};

export const StatusBadge: React.FC<{ status?: AnalystStatus }> = ({ status }) => {
  if (!status || status === 'NEW') return null;
  const s = STATUS_LABEL[status];
  return <span className={`${base} ${s.cls}`}>{s.text}</span>;
};
