import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sound } from '../utils/audio';

interface PreloaderProps {
  onComplete: () => void;
}

export const Preloader: React.FC<PreloaderProps> = ({ onComplete }) => {
  const [percent, setPercent] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    sound.playRadarPing();

    const timer = setInterval(() => {
      setPercent(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setIsFinishing(true);
          sound.playSuccessChime();
          setTimeout(() => {
            onComplete();
          }, 800);
          return 100;
        }
        const increment = prev < 50 ? Math.floor(Math.random() * 5) + 3 : Math.floor(Math.random() * 8) + 4;
        const next = Math.min(prev + increment, 100);
        if (next % 20 === 0) sound.playClick();
        return next;
      });
    }, 40);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {!isFinishing ? (
        <motion.div
          key="melon-preloader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-[#080808] flex flex-col justify-between p-8 sm:p-14 select-none overflow-hidden"
        >
          {/* Top Bar with Skip */}
          <div className="flex justify-between items-center text-xs tracking-widest text-slate-500 font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-slate-400">RAJASTHAN POLICE // R4C HACKATHON 2026</span>
            </div>
            <button
              onClick={() => {
                sound.playSuccessChime();
                setIsFinishing(true);
                setTimeout(onComplete, 400);
              }}
              className="text-slate-500 hover:text-white px-3 py-1 border border-slate-800 rounded text-[11px] transition-colors"
            >
              SKIP [ESC]
            </button>
          </div>

          {/* Center: Melon Studio-style emblem and typography */}
          <div className="my-auto text-center flex flex-col items-center justify-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <h1 className="text-5xl sm:text-8xl md:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-600 font-display uppercase">
                PRAHARI
              </h1>
              <div className="text-xs sm:text-sm tracking-[0.4em] font-mono text-red-500 uppercase mt-2">
                CROSS-CHANNEL OSINT PLATFORM
              </div>
            </motion.div>
          </div>

          {/* Bottom Row: LOAD... on bottom-left, Giant Melon-style Percentage on bottom-right */}
          <div className="flex items-end justify-between font-mono">
            <div className="text-xs tracking-[0.25em] text-slate-500">
              LOAD...
            </div>

            {/* Massive Melon Studio 000% - 100% Counter */}
            <div className="text-right leading-none">
              <div className="text-7xl sm:text-9xl md:text-[11rem] font-bold text-white tracking-tighter font-sans select-none">
                {String(percent).padStart(3, '0')}
                <span className="text-3xl sm:text-6xl text-slate-500 ml-1 font-mono font-normal">%</span>
              </div>
            </div>
          </div>

          {/* Bottom Edge progress line */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900">
            <motion.div
              className="h-full bg-red-500 shadow-[0_0_15px_#EF4444]"
              style={{ width: `${percent}%` }}
              transition={{ ease: 'linear' }}
            />
          </div>
        </motion.div>
      ) : (
        /* The signature Melon Studio Red Liquid Wave Transition */
        <motion.div
          key="liquid-curtain"
          initial={{ y: '100%' }}
          animate={{ y: '-100%' }}
          transition={{ duration: 0.85, ease: [0.77, 0, 0.175, 1] }}
          className="fixed inset-0 z-50 bg-[#E50914] flex items-center justify-center pointer-events-none"
        >
          <div className="text-white text-6xl sm:text-9xl font-black font-display tracking-tight opacity-20">
            PRAHARI
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
