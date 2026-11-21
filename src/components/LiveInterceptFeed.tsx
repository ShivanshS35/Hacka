import React, { useState } from 'react';
import { Radio, Search, Filter, Upload, AlertCircle, Clock, Eye, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import { InterceptPost, CrimeCategory } from '../types';
import { sound } from '../utils/audio';

interface LiveInterceptFeedProps {
  posts: InterceptPost[];
  selectedPost: InterceptPost | null;
  onSelectPost: (post: InterceptPost) => void;
  activeCategory: CrimeCategory | 'ALL';
  onSelectCategory: (cat: CrimeCategory | 'ALL') => void;
  onOpenUploadModal: () => void;
  isSimulating: boolean;
  onToggleSimulate: () => void;
}

export const LiveInterceptFeed: React.FC<LiveInterceptFeedProps> = ({
  posts,
  selectedPost,
  onSelectPost,
  activeCategory,
  onSelectCategory,
  onOpenUploadModal,
  isSimulating,
  onToggleSimulate
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [minConfidence, setMinConfidence] = useState(0.85);

  const categories: (CrimeCategory | 'ALL')[] = ['ALL', 'DRUGS', 'ARMS', 'DOCUMENTS', 'FINANCIAL'];

  // Filter posts based on category, search, and confidence
  const filteredPosts = posts.filter(post => {
    if (activeCategory !== 'ALL' && !post.categories.includes(activeCategory)) {
      return false;
    }
    if (post.confidence < minConfidence) {
      return false;
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchText = post.rawText.toLowerCase().includes(q);
      const matchChannel = post.channel.toLowerCase().includes(q);
      const matchDistrict = post.districtName.toLowerCase().includes(q);
      const matchEntity = [
        ...post.entities.phones,
        ...post.entities.upis,
        ...post.entities.handles,
        ...post.entities.wallets
      ].some(e => e.toLowerCase().includes(q));

      if (!matchText && !matchChannel && !matchDistrict && !matchEntity) {
        return false;
      }
    }
    return true;
  });

  const getCategoryBadgeClass = (cat: CrimeCategory) => {
    switch (cat) {
      case 'DRUGS':
        return 'bg-red-950/80 text-red-400 border-red-500/40';
      case 'ARMS':
        return 'bg-amber-950/80 text-amber-400 border-amber-500/40';
      case 'DOCUMENTS':
        return 'bg-purple-950/80 text-purple-400 border-purple-500/40';
      case 'FINANCIAL':
        return 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40';
    }
  };

  // Helper to highlight matched slang terms in text
  const highlightSlang = (text: string, matchedTerms: string[]) => {
    if (!matchedTerms || matchedTerms.length === 0) return text;

    // Build regex to match any of the slang terms case-insensitively
    const escaped = matchedTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    if (!escaped) return text;
    const regex = new RegExp(`(${escaped})`, 'gi');

    const parts = text.split(regex);
    return parts.map((part, index) => {
      if (regex.test(part)) {
        return (
          <span
            key={index}
            className="bg-red-500/25 text-red-300 font-semibold px-1 rounded border-b border-red-400"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="h-full bg-[#0b0f16] border-r border-slate-800 flex flex-col font-mono text-xs select-none">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-slate-800 bg-[#0e141e] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="font-bold text-white tracking-wider">LIVE TELEGRAM INTERCEPT FEED</span>
          </div>
          <span className="bg-red-950/80 text-red-400 border border-red-800 px-2 py-0.5 rounded text-[10px] font-bold">
            {filteredPosts.length} ACTIVE
          </span>
        </div>

        {/* Live Simulation & Import Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              sound.playClick();
              onToggleSimulate();
            }}
            className={`flex-1 py-1.5 px-2.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
              isSimulating
                ? 'bg-cyan-950 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,229,255,0.3)]'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isSimulating ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'}`} />
            <span>SIMULATOR: {isSimulating ? 'ACTIVE' : 'PAUSED'}</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              onOpenUploadModal();
            }}
            className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 text-cyan-400 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>IMPORT</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search slang, UPI, handle, channel..."
            className="w-full bg-[#06080d] border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-xs"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => {
                sound.playClick();
                onSelectCategory(cat);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                activeCategory === cat
                  ? 'bg-cyan-400 text-black shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Confidence Threshold Slider */}
        <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400">
          <span>MIN CONFIDENCE:</span>
          <input
            type="range"
            min="0.50"
            max="0.95"
            step="0.05"
            value={minConfidence}
            onChange={e => setMinConfidence(parseFloat(e.target.value))}
            className="w-24 accent-cyan-400 cursor-pointer"
          />
          <span className="text-cyan-400 font-bold">{(minConfidence * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Feed List Container */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 p-2 space-y-2">
        {filteredPosts.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No intercepts matching current criteria.</p>
          </div>
        ) : (
          filteredPosts.map(post => {
            const isSelected = selectedPost?.id === post.id;
            return (
              <div
                key={post.id}
                onClick={() => {
                  sound.playClick();
                  onSelectPost(post);
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#141e2e] border-cyan-400 shadow-[0_0_20px_rgba(0,229,255,0.2)]'
                    : 'bg-[#0d121c] border-slate-800/80 hover:border-slate-700 hover:bg-[#101724]'
                }`}
              >
                {/* Post Header: Channel, Category Badge, Confidence */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-cyan-400 font-bold">{post.channel}</span>
                    <span className="text-[10px] text-slate-500">({post.districtName})</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {post.categories.map(c => (
                      <span
                        key={c}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${getCategoryBadgeClass(c)}`}
                      >
                        {c}
                      </span>
                    ))}
                    <span className="bg-slate-900 text-emerald-400 border border-slate-700 px-1.5 py-0.5 rounded text-[9px] font-bold">
                      {post.confidence.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Raw Text with Slang Highlighting */}
                <p className="text-slate-200 font-sans text-xs leading-relaxed mb-2">
                  "{highlightSlang(post.rawText, post.matchedSlang)}"
                </p>

                {/* Extracted Identifiers Pills */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {post.entities.upis.map(u => (
                    <span
                      key={u}
                      className="bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 px-1.5 py-0.2 rounded text-[9px]"
                    >
                      UPI: {u}
                    </span>
                  ))}
                  {post.entities.phones.map(p => (
                    <span
                      key={p}
                      className="bg-amber-950/80 text-amber-300 border border-amber-800/80 px-1.5 py-0.2 rounded text-[9px]"
                    >
                      TEL: {p}
                    </span>
                  ))}
                  {post.entities.wallets.map(w => (
                    <span
                      key={w}
                      className="bg-red-950/80 text-red-300 border border-red-800/80 px-1.5 py-0.2 rounded text-[9px]"
                    >
                      CRYPTO: {w.slice(0, 8)}...
                    </span>
                  ))}
                </div>

                {/* Footer Telemetry */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(post.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                  </span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <Eye className="w-3 h-3" />
                    {post.views.toLocaleString()} views
                  </span>
                  <span className="text-emerald-400 text-[9px] font-semibold">
                    ✓ SEC 65B
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
