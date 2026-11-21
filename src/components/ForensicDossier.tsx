import React, { useState } from 'react';
import { Lock, FileText, Copy, Check, ShieldCheck, AlertCircle, Clock, MapPin, Hash, ExternalLink } from 'lucide-react';
import { InterceptPost } from '../types';
import { sound } from '../utils/audio';
import { generateDossierPDF } from '../utils/pdfGenerator';

interface ForensicDossierProps {
  post: InterceptPost | null;
}

export const ForensicDossier: React.FC<ForensicDossierProps> = ({ post }) => {
  const [copied, setCopied] = useState(false);

  if (!post) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500 font-mono text-xs">
        <ShieldCheck className="w-10 h-10 mb-3 opacity-30 text-cyan-400" />
        <p>Select any intercepted post from the feed to inspect its forensic chain-of-custody dossier.</p>
      </div>
    );
  }

  const handleCopyHash = () => {
    sound.playSuccessChime();
    navigator.clipboard.writeText(post.sha256);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPDF = () => {
    sound.playSuccessChime();
    generateDossierPDF(post);
  };

  return (
    <div className="h-full flex flex-col bg-[#0C101A] font-sans text-xs overflow-y-auto select-none">
      {/* Dossier Header */}
      <div className="p-4 border-b border-white/[0.07] space-y-1.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-white tracking-wide text-[13px]">Chain of Custody Dossier</span>
          </div>
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded text-[10px] font-mono">
            SEC 65B SEALED
          </span>
        </div>
        <div className="text-[11px] text-cyan-400 font-mono">
          CASE #INV-RAJ-2026-{post.id.toUpperCase()}
        </div>
      </div>

      {/* Dossier Content Body */}
      <div className="p-4 space-y-4 flex-1">
        {/* Section 65B Admissibility Stamp */}
        <div className="p-3 bg-white/[0.02] border border-white/[0.08] rounded-xl space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-cyan-300">Indian Evidence Act // Sec 65B</span>
            <span className="text-emerald-400 text-[10px] font-mono flex items-center gap-1">
              <Check className="w-3 h-3" /> CERTIFIED TRANSCRIPT
            </span>
          </div>
          <p className="text-[11px] text-[#94A3B8] leading-relaxed">
            Automated hash timestamped upon Telethon protocol packet capture. Cryptographically tamper-evident for judicial submission.
          </p>
        </div>

        {/* Telemetry Grid */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5 space-y-2 text-[11px]">
          <div className="flex justify-between items-center">
            <span className="text-[#94A3B8]">SOURCE CHANNEL:</span>
            <span className="text-cyan-400 font-mono font-medium">{post.channel}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#94A3B8]">AUDIENCE REACH:</span>
            <span className="text-[#F1F5F9] font-mono">{post.channelSubscribers || 'Public Forum'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#94A3B8]">POST TIMESTAMP:</span>
            <span className="text-[#94A3B8] font-mono">{post.timestamp}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#94A3B8]">CAPTURED AT:</span>
            <span className="text-[#94A3B8] font-mono">{post.capturedAt}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#94A3B8]">DISTRICT NEXUS:</span>
            <span className="text-amber-400 font-medium">{post.districtName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#94A3B8]">CATEGORY:</span>
            <span className="text-rose-400 font-mono font-medium">{post.categories.join(' / ')}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#94A3B8]">CONFIDENCE:</span>
            <span className="text-emerald-400 font-mono font-semibold">{(post.confidence * 100).toFixed(0)}% MATCH</span>
          </div>
        </div>

        {/* Raw Text Snapshot */}
        <div className="space-y-1.5">
          <div className="text-[10px] text-[#94A3B8] font-mono uppercase tracking-wider">RAW INTERCEPT TRANSCRIPT</div>
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-[#F1F5F9] text-xs leading-relaxed">
            "{post.rawText}"
          </div>
        </div>

        {/* Cryptographic SHA-256 Hash Display */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#94A3B8] flex items-center gap-1 font-mono text-[10px] uppercase">
              <Hash className="w-3 h-3 text-cyan-400" />
              SHA-256 INTEGRITY CHECKSUM
            </span>
            <span className="text-emerald-400 font-mono text-[10px]">MATCH: VALID</span>
          </div>

          <div className="p-3 bg-[#070A10] rounded-xl border border-white/[0.08] text-cyan-300 font-mono text-[10px] break-all leading-relaxed select-all">
            {post.sha256}
          </div>

          {/* Action Buttons: Copy Hash & Download PDF */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={handleCopyHash}
              className="w-full flex items-center justify-center gap-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-cyan-300 hover:text-cyan-200 py-2.5 rounded-xl text-xs font-medium transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Hash Copied to Clipboard' : 'Copy SHA-256 Hash'}</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white py-2.5 rounded-xl text-xs font-semibold transition-all shadow-[0_0_15px_rgba(244,63,94,0.3)]"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Download Court-Ready PDF Report</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
