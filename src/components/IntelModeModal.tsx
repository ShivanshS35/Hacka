import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Radio, Flame, Biohazard, UserCheck, ExternalLink, X, ArrowRight } from 'lucide-react';
import { sound } from '../utils/audio';

interface IntelModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode: (mode: string) => void;
}

export const IntelModeModal: React.FC<IntelModeModalProps> = ({
  isOpen,
  onClose,
  onSelectMode
}) => {
  const [selectedPoi, setSelectedPoi] = useState<'RAJESH' | 'MULE_HUB'>('RAJESH');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  if (!isOpen) return null;

  const categories = [
    { id: 'ALL', label: 'ALL' },
    { id: 'WAR', label: '[WAR]' },
    { id: 'CYB', label: '[CYB]' },
    { id: 'MAR', label: '[MAR]' },
    { id: 'DIS', label: '[DIS]' },
    { id: 'NRG', label: '[NRG]' },
    { id: 'UAP', label: '[UAP]' },
    { id: 'CON', label: '[CON]' },
    { id: 'BIO', label: '[BIO]' },
    { id: 'WCG', label: '[WCG]' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md select-none font-mono">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative bg-[#060a0f] border border-emerald-500/30 rounded-xl w-full max-w-3xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.9),0_0_30px_rgba(16,185,129,0.15)] flex flex-col max-h-[92vh]"
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-[#090e16]">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span>● WARMONITOR // PRAHARI • OPERATOR SETUP</span>
            </div>
            <button
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="text-slate-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-widest text-white uppercase font-display">
            SELECT INTEL MODE
          </h2>

          <div className="flex items-center gap-3 mt-2">
            <span className="border border-red-500/50 bg-red-950/30 text-red-400 text-[10px] tracking-widest px-2 py-0.5 rounded font-bold">
              UNCLASSIFIED // FOUO
            </span>
            <span className="text-slate-400 text-xs">
              Choose your focus area. Switch modes anytime from the top bar.
            </span>
          </div>
        </div>

        {/* Modal Main Body (2 Columns as in WarMonitor) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-y-auto">
          {/* Left Column (8 cols): What's New & Categories */}
          <div className="md:col-span-8 p-4 sm:p-5 border-b md:border-b-0 md:border-r border-slate-800 space-y-4">
            <div className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase">
              + WHAT'S NEW THIS WEEK
            </div>

            {/* Feature Card 1: Outbreak */}
            <div
              onClick={() => {
                sound.playRadarPing();
                onSelectMode('NARCOTICS');
                onClose();
              }}
              className="bg-[#0b111a] hover:bg-[#0f1724] border border-amber-500/40 hover:border-amber-400 p-3.5 rounded-lg cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <Biohazard className="w-4 h-4 text-amber-400" />
                  <span>Outbreak Mode — Chitta / Narcotics</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-[9px] px-1.5 py-0.5 rounded font-bold">LIVE</span>
                  <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] px-1.5 py-0.5 rounded font-bold">NEW</span>
                </div>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Live case map, Telegram intercepts, narcotics & contraband hotlines across Rajasthan border districts.
              </p>
            </div>

            {/* Feature Card 2: Persons of Interest */}
            <div
              onClick={() => {
                sound.playRadarPing();
                onSelectMode('POI');
                onClose();
              }}
              className="bg-[#0b111a] hover:bg-[#0f1724] border border-purple-500/40 hover:border-purple-400 p-3.5 rounded-lg cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                  <UserCheck className="w-4 h-4 text-purple-400" />
                  <span>Persons of Interest</span>
                </div>
                <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[9px] px-1.5 py-0.5 rounded font-bold">NEW</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Mule bank accounts & illicit arms networks with cross-linked entity map connections (Hero: raj.pay@oksbi).
              </p>
            </div>

            {/* Cyber Cell Badge Button */}
            <div className="p-3 bg-gradient-to-r from-emerald-950/40 to-cyan-950/40 border border-emerald-500/40 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                <Shield className="w-4 h-4" />
                <span>HACKATHON PROTOTYPE MODE</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">AUTHORIZED</span>
            </div>

            {/* Category Chips Grid */}
            <div className="space-y-1.5">
              <div className="text-[10px] text-slate-500 font-bold">FILTER CATEGORY:</div>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      sound.playClick();
                      setActiveCategory(c.id);
                    }}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors ${
                      activeCategory === c.id
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-[#090d14] border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-mono">@prahariINTEL</span>
              <button
                onClick={() => {
                  sound.playSuccessChime();
                  onClose();
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors"
              >
                <span>ENTER COMMAND CENTER</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Column (4 cols): Persons of Interest selection column */}
          <div className="md:col-span-4 p-4 sm:p-5 bg-[#05080c] space-y-3">
            <div className="text-[10px] text-purple-400 font-bold tracking-widest uppercase flex items-center justify-between">
              <span>= P.O.I.</span>
              <span className="text-[9px] text-slate-500">2 TRACKED</span>
            </div>

            <div className="text-[11px] text-slate-400 font-bold uppercase mb-2">
              PERSONS OF INTEREST
            </div>

            {/* POI Card 1 */}
            <div
              onClick={() => {
                sound.playClick();
                setSelectedPoi('RAJESH');
              }}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                selectedPoi === 'RAJESH'
                  ? 'bg-purple-950/40 border-purple-400 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]'
                  : 'bg-[#0a0f16] border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="text-xs font-bold flex items-center gap-1.5">
                <span className="text-purple-400">⌘</span>
                <span>RAJESH KUMAR</span>
              </div>
              <div className="text-[10px] text-cyan-400 font-mono mt-0.5">@seller_raj</div>
              <div className="text-[9px] text-slate-500 mt-1">Cross-Channel Syndicate Leader</div>
            </div>

            {/* POI Card 2 */}
            <div
              onClick={() => {
                sound.playClick();
                setSelectedPoi('MULE_HUB');
              }}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                selectedPoi === 'MULE_HUB'
                  ? 'bg-amber-950/40 border-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                  : 'bg-[#0a0f16] border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="text-xs font-bold flex items-center gap-1.5">
                <span className="text-amber-400">⌘</span>
                <span>MULE ESCROW HUB</span>
              </div>
              <div className="text-[10px] text-amber-300 font-mono mt-0.5">raj.pay@oksbi</div>
              <div className="text-[9px] text-slate-500 mt-1">Jaipur & Jodhpur Banking Nexus</div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 text-[10px] text-slate-500">
              CLICK TO FOCUS DOSSIER ON MAP
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#040609] border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>SECURE OPERATOR CONSOLE</span>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="hover:text-emerald-400 transition-colors uppercase text-[10px]"
          >
            PRESS TO SKIP [ESC]
          </button>
        </div>
      </motion.div>
    </div>
  );
};
