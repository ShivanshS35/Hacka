import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sound } from '../utils/audio';

interface WarMonitorBootLoaderProps {
  onComplete: () => void;
}

export const WarMonitorBootLoader: React.FC<WarMonitorBootLoaderProps> = ({ onComplete }) => {
  const [percent, setPercent] = useState(0);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [authProgress, setAuthProgress] = useState(false);

  const bootLogs = [
    "[INT] Connecting to RSS intelligence aggregators...",
    "[INT] Initializing CoinGecko market feeds...",
    "[SEC] Loading conflict zone database (22 active zones)...",
    "[SEC] Initializing Country Instability Index (CII)...",
    "[SEC] Loading convergence detection engine...",
    "[HUD] Configuring tactical HUD overlays...",
    "[VIS] Loading visual filter modes (8 modes)...",
    "[CAM] Indexing global CCTV camera feeds...",
    "[AIS] Connecting to maritime vessel tracking...",
    "[TRN] Connecting to EU rail APIs (FI/DE/CH)...",
    "[WX] Loading global weather stations...",
    "[OK] All systems nominal. 24+ data layers active.",
    "[OK] PRAHARI OSINT ready. Welcome, operator."
  ];

  useEffect(() => {
    sound.playRadarPing();
    const timer = setInterval(() => {
      setPercent(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setAuthProgress(true);
          sound.playSuccessChime();
          setTimeout(() => {
            onComplete();
          }, 1000);
          return 100;
        }
        const next = Math.min(prev + 5, 100);
        const logIndex = Math.floor((next / 100) * bootLogs.length);
        setTerminalLines(bootLogs.slice(0, logIndex + 1));
        if (next % 20 === 0) sound.playClick();
        return next;
      });
    }, 60);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#04070a] flex flex-col items-center justify-center p-4 font-mono select-none">
      {/* Background radial ring */}
      <div className="relative mb-8 flex flex-col items-center">
        {/* Concentric radar rings */}
        <div className="relative w-24 h-24 flex items-center justify-center mb-6">
          <div className="absolute inset-0 rounded-full border border-emerald-500/20" />
          <div className="absolute inset-3 rounded-full border border-emerald-500/30" />
          <div className="absolute inset-6 rounded-full border border-emerald-500/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_#10B981] animate-ping" />
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-black tracking-[0.25em] text-emerald-400 text-center mb-2 font-mono">
          PRAHARI // WARMONITOR
        </h1>
        <div className="text-[11px] tracking-[0.3em] text-slate-500 uppercase text-center mb-4">
          GLOBAL INTELLIGENCE & ILLICIT TRADE PLATFORM
        </div>

        <div className="border border-red-500/40 bg-red-950/20 text-red-400 text-[10px] tracking-widest px-3 py-0.5 rounded font-bold uppercase">
          UNCLASSIFIED // FOUO
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-lg mb-2 flex items-center justify-between text-[11px] text-emerald-400">
        <span className="tracking-widest">INITIALIZING</span>
        <span className="font-bold">{percent}%</span>
      </div>
      <div className="w-full max-w-lg h-1 bg-slate-900 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-emerald-400 shadow-[0_0_10px_#10B981] transition-all duration-75"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Terminal log box */}
      <div className="w-full max-w-lg h-56 bg-[#030508] border border-slate-800 rounded-lg p-4 font-mono text-[11px] overflow-hidden flex flex-col justify-between text-slate-400 shadow-2xl">
        <div className="space-y-1 overflow-y-auto">
          {terminalLines.map((line, idx) => (
            <div
              key={idx}
              className={`${
                line.includes('[OK]')
                  ? 'text-emerald-400 font-bold'
                  : line.includes('[SEC]')
                  ? 'text-amber-400'
                  : 'text-slate-400'
              }`}
            >
              {line}
            </div>
          ))}

          {authProgress && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pt-2 border-t border-slate-800 text-slate-300 space-y-0.5"
            >
              <div className="text-cyan-400 font-bold">[AUTH] CREDENTIAL VERIFICATION</div>
              <div className="text-slate-400">OPERATOR: <span className="text-white">SIERRA-7X</span> ✓</div>
              <div className="text-slate-400">CLEARANCE: <span className="text-red-400">TS//SCI//NOFORN</span> ✓</div>
              <div className="text-emerald-400">AUTH TOKEN: <span className="tracking-widest">••••••••</span> █</div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Skip button */}
      <button
        onClick={() => {
          sound.playSuccessChime();
          onComplete();
        }}
        className="mt-6 text-[10px] tracking-widest text-slate-500 hover:text-emerald-400 transition-colors uppercase"
      >
        PRESS TO SKIP [ESC]
      </button>
    </div>
  );
};
