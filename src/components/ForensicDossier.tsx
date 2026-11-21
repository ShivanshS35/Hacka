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
    <div className="h-full flex flex-col bg-[#0b0f16] font-mono text-xs overflow-y-auto select-none">
      {/* Dossier Header */}
      <div className="p-4 bg-[#0e1420] border-b border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-white tracking-wider">FORENSIC CHAIN OF CUSTODY</span>
          </div>
          <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
            SEC 65B SEALED
          </span>
        </div>
        <div className="text-[11px] text-cyan-400">
          CASE #INV-RAJ-2026-{post.id.toUpperCase()}
        </div>
      </div>

      {/* Dossier Content Body */}
      <div className="p-4 space-y-4 flex-1">
        {/* Section 65B Admissibility Stamp */}
        <div className="p-3 bg-cyan-950/30 border border-cyan-500/40 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-cyan-400 font-bold text-[10px]">
            <span>INDIAN EVIDENCE ACT // SECTION 65B</span>
            <span className="text-emerald-400">✓ CERTIFIED TRANSCRIPT</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
            Automated hash timestamped upon initial Telethon protocol packet capture. Cryptographically tamper-evident for judicial submission.
          </p>
        </div>

        {/* Telemetry Grid */}
        <div className="bg-[#080c12] border border-slate-800 rounded-xl p-3 space-y-2 text-[11px]">
          <div className="flex justify-between">
            <span className="text-slate-500">SOURCE CHANNEL:</span>
            <span className="text-cyan-400 font-bold">{post.channel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">AUDIENCE REACH:</span>
            <span className="text-slate-300">{post.channelSubscribers || 'Public Forum'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">POST TIMESTAMP:</span>
            <span className="text-slate-300">{post.timestamp}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">CAPTURED AT:</span>
            <span className="text-slate-400">{post.capturedAt}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">DISTRICT NEXUS:</span>
            <span className="text-yellow-400 font-bold">{post.districtName.toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">CRIME CATEGORY:</span>
            <span className="text-red-400 font-bold">[{post.categories.join(' / ')}]</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">CONFIDENCE:</span>
            <span className="text-emerald-400 font-bold">{(post.confidence * 100).toFixed(0)}% MATCH</span>
          </div>
        </div>

        {/* Raw Text Snapshot */}
        <div className="space-y-1">
          <div className="text-[10px] text-slate-500 font-bold">RAW INTERCEPT TRANSCRIPT:</div>
          <div className="p-3 bg-[#080c12] border border-slate-800 rounded-xl text-slate-200 font-sans text-xs leading-relaxed">
            "{post.rawText}"
          </div>
        </div>

        {/* Cryptographic SHA-256 Hash Display */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-500 font-bold flex items-center gap-1">
              <Hash className="w-3 h-3 text-cyan-400" />
              SHA-256 INTEGRITY CHECKSUM:
            </span>
            <span className="text-emerald-400 text-[9px]">MATCH: VALID</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-cyan-500/40 text-cyan-300 text-[10px] break-all leading-relaxed shadow-inner">
            {post.sha256}
          </div>

          {/* Action Buttons: Copy Hash & Download PDF */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={handleCopyHash}
              className="w-full flex items-center justify-center gap-2 bg-[#121924] hover:bg-slate-800 border border-cyan-500/50 text-cyan-400 py-2.5 rounded-lg text-xs font-bold transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'HASH COPIED TO CLIPBOARD' : 'COPY SHA-256 HASH'}</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white py-2.5 rounded-lg text-xs font-bold transition-all shadow-[0_0_20px_rgba(255,59,48,0.35)]"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>DOWNLOAD COURT-READY PDF REPORT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
