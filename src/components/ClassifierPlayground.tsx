import React, { useState } from 'react';
import { Terminal, Play, CheckCircle, RefreshCw, Sparkles, Copy, Check } from 'lucide-react';
import { classifyText } from '../utils/detectionEngine';
import { sound } from '../utils/audio';

export const ClassifierPlayground: React.FC = () => {
  const [inputText, setInputText] = useState('Pure white available. 5g = ₹8000. DM @seller_raj. UPI advance: raj.pay@oksbi');
  const [copied, setCopied] = useState(false);

  const presets = [
    {
      label: 'DRUGS',
      color: 'border-red-500/40 text-red-400 bg-red-950/20',
      text: 'Pure white available. 5g = ₹8000. DM @seller_raj. UPI advance: raj.pay@oksbi'
    },
    {
      label: 'ARMS',
      color: 'border-orange-500/40 text-orange-400 bg-orange-950/20',
      text: 'Desi katta .32 bore brand new consignment. 10 round cartridges. Crypto bc1qar...mdq or call 9876543210'
    },
    {
      label: 'DOCUMENTS',
      color: 'border-purple-500/40 text-purple-400 bg-purple-950/20',
      text: 'Fake Aadhaar + PAN card set. Instant verification pass. ₹2500 only. 3 din me home delivery in Kota.'
    },
    {
      label: 'FINANCIAL',
      color: 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20',
      text: 'Fully KYC verified current account with ATM card + kit. ₹15000. UPI raj.pay@oksbi or DM @mule_bazaar'
    }
  ];

  const result = classifyText(inputText);

  const handleCopy = () => {
    sound.playSuccessChime();
    navigator.clipboard.writeText(inputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#090C10] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl font-mono">
      {/* Terminal Title Bar */}
      <div className="bg-[#0e131a] px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="text-xs text-slate-400 font-semibold ml-2 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            prahari — classify.py (KEYWORD LEXICON + REGEX)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 px-2 py-0.5 rounded">
            RULE-BASED // NOT A TRAINED MODEL
          </span>
          <button
            onClick={handleCopy}
            className="text-slate-400 hover:text-cyan-400 p-1 text-xs"
            title="Copy command input"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Preset Buttons */}
      <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex flex-wrap gap-2 items-center">
        <span className="text-xs text-slate-500 mr-2 font-sans font-medium">PRESET PROMPTS:</span>
        {presets.map(p => (
          <button
            key={p.label}
            onClick={() => {
              sound.playClick();
              setInputText(p.text);
            }}
            className={`text-xs px-3 py-1 rounded-md border font-semibold transition-all hover:scale-105 ${p.color}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Terminal Body */}
      <div className="p-5 space-y-4 text-xs sm:text-sm">
        {/* Input prompt */}
        <div className="space-y-1">
          <div className="text-slate-400 flex items-center gap-1">
            <span className="text-cyan-400 font-bold">&gt;&gt;&gt;</span>
            <span className="text-emerald-400">classify</span>
            <span className="text-slate-300">(</span>
            <span className="text-slate-500">text: str</span>
            <span className="text-slate-300">)</span>
          </div>

          <div className="relative mt-2">
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              rows={2}
              className="w-full bg-[#05070a] border border-cyan-500/30 rounded-lg p-3 text-cyan-300 focus:outline-none focus:border-cyan-400 text-xs sm:text-sm resize-none shadow-inner"
              placeholder="Type any Hinglish, Hindi, or English message..."
            />
          </div>
        </div>

        {/* Output Evaluation Block */}
        <div className="bg-[#05070a] rounded-lg p-4 border border-slate-800 space-y-2">
          <div className="text-slate-500 text-[11px] font-mono">
            # RULE-MATCH RESULT // SCORE IS A RULE WEIGHT, NOT A PROBABILITY
          </div>

          <div className="text-slate-200">
            <span className="text-yellow-400 font-bold">Classification</span>(
            <div className="pl-4 space-y-1 text-slate-300">
              <div>
                <span className="text-slate-400">categories=</span>
                <span className="text-red-400 font-bold">[{result.categories.map(c => `'${c.toLowerCase()}'`).join(', ')}]</span>,
              </div>
              <div>
                <span className="text-slate-400">confidence=</span>
                <span className="text-emerald-400 font-bold">{result.confidence}</span>,
              </div>
              <div>
                <span className="text-slate-400">matched_terms=</span>
                <span className="text-cyan-400">[{result.matchedTerms.map(t => `'${t}'`).join(', ')}]</span>,
              </div>
              <div>
                <span className="text-slate-400">extracted_identifiers=</span>
                <span className="text-yellow-300">
                  {`{ 'upi': [${result.extracted.upis.map(u => `'${u}'`).join(', ')}], 'phone': [${result.extracted.phones.map(p => `'${p}'`).join(', ')}], 'telegram': [${result.extracted.handles.map(h => `'${h}'`).join(', ')}], 'crypto': [${result.extracted.wallets.map(w => `'${w}'`).join(', ')}] }`}
                </span>
              </div>
            </div>
            )
          </div>

          {/* Quick Badges Preview */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-slate-400 font-sans">Confidence Gauge:</span>
            <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-red-500 rounded-full transition-all duration-300"
                style={{ width: `${result.confidence * 100}%` }}
              />
            </div>
            <span className="text-cyan-400 font-bold">{(result.confidence * 100).toFixed(0)}% MATCH</span>

            {result.extracted.upis.length > 0 && (
              <span className="ml-auto bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800 text-[10px]">
                HERO UPI: {result.extracted.upis[0]}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
