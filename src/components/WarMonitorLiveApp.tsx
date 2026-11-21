import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  Shield,
  Radio,
  Biohazard,
  Network,
  Lock,
  Maximize2,
  Clock,
  User,
  Search,
  ExternalLink,
  X,
  Flame,
  Crosshair,
  ShieldAlert,
  Users,
  Copy,
  Check,
  FileText,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Camera,
  Layers,
  MapPin,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { RajasthanMap } from './RajasthanMap';
import { IntelModeModal } from './IntelModeModal';
import { UploadModal } from './UploadModal';
import { InterceptPost, DistrictIntel, CrimeCategory, DistrictConnection } from '../types';
import { RAJASTHAN_DISTRICTS, DISTRICT_CONNECTIONS, INITIAL_INTERCEPTS, ENTITY_GRAPH_DATA } from '../data/mockData';
import { sound } from '../utils/audio';
import { generateDossierPDF } from '../utils/pdfGenerator';
import { classifyText, generateSHA256 } from '../utils/detectionEngine';

interface WarMonitorLiveAppProps {
  onOpenEditorial: () => void;
}

export const WarMonitorLiveApp: React.FC<WarMonitorLiveAppProps> = ({ onOpenEditorial }) => {
  const [posts, setPosts] = useState<InterceptPost[]>(INITIAL_INTERCEPTS);
  const [districts, setDistricts] = useState<DistrictIntel[]>(RAJASTHAN_DISTRICTS);
  const [connections, setConnections] = useState<DistrictConnection[]>(DISTRICT_CONNECTIONS);
  const [selectedPost, setSelectedPost] = useState<InterceptPost | null>(INITIAL_INTERCEPTS[0]);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictIntel | null>(RAJASTHAN_DISTRICTS[0]);

  // Window visibility toggles (WarMonitor floating HUD windows)
  const [showOutbreakAlert, setShowOutbreakAlert] = useState(true);
  const [showIntelFeed, setShowIntelFeed] = useState(true);
  const [showPoiDossier, setShowPoiDossier] = useState(true);
  const [showTelegramToast, setShowTelegramToast] = useState(true);
  const [showBottomDrawer, setShowBottomDrawer] = useState(true);
  const [isIntelModeModalOpen, setIsIntelModeModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Active filters & modes
  const [activeCategory, setActiveCategory] = useState<CrimeCategory | 'ALL'>('ALL');
  const [activePoiTab, setActivePoiTab] = useState<'CONNECTIONS' | 'TIMELINE' | 'NETWORK' | 'FORENSIC'>('CONNECTIONS');
  const [activeFeedTab, setActiveFeedTab] = useState<'OSINT' | 'TELEGRAM' | 'DISTRICT' | 'CYBER'>('TELEGRAM');
  const [feedSearch, setFeedSearch] = useState('');
  const [copiedHash, setCopiedHash] = useState(false);
  const [isMuted, setIsMuted] = useState(!sound.enabled);
  const [clockUtc, setClockUtc] = useState('');

  // Update clock in UTC matching WarMonitor format
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClockUtc(now.toISOString().slice(11, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyHash = (hash: string) => {
    sound.playSuccessChime();
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleDownloadPDF = (post: InterceptPost) => {
    sound.playSuccessChime();
    generateDossierPDF(post);
  };

  const toggleSound = () => {
    sound.enabled = !sound.enabled;
    setIsMuted(!sound.enabled);
    sound.playClick();
  };

  return (
    <div className="h-screen w-screen bg-[#04070a] text-slate-100 flex flex-col overflow-hidden font-mono text-xs select-none relative">
      {/* 1. TOP WARMONITOR TACTICAL NAVBAR */}
      <header className="bg-[#05080c] border-b border-slate-800/90 px-3 py-1.5 flex items-center justify-between z-30 shrink-0 text-[11px]">
        {/* Left Section */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              sound.playClick();
              setIsIntelModeModalOpen(true);
            }}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded"
            title="Open Intel Modes"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* WarMonitor / PRAHARI Logo */}
          <div className="flex items-center gap-1.5 font-bold tracking-wider text-white">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            <span className="text-emerald-400">● PRAHARI</span>
          </div>

          {/* Mode Pill (Exact Orange Box from WarMonitor screenshot) */}
          <button
            onClick={() => {
              sound.playClick();
              setIsIntelModeModalOpen(true);
            }}
            className="hidden sm:flex items-center gap-1.5 border border-amber-500/80 bg-amber-950/20 text-amber-400 px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider hover:bg-amber-900/30 transition-colors"
          >
            <span>RAJASTHAN ILLICIT TRADE // CROSS-CHANNEL OSINT NETWORK</span>
          </button>
        </div>

        {/* Center Filter Buttons */}
        <div className="hidden lg:flex items-center gap-1 bg-[#090e16] border border-slate-800 p-0.5 rounded-lg text-[10px]">
          <button
            onClick={() => {
              sound.playClick();
              setActiveCategory('ALL');
            }}
            className={`px-2 py-0.5 rounded font-bold transition-colors ${
              activeCategory === 'ALL' ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50' : 'text-slate-400 hover:text-white'
            }`}
          >
            CRIME
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setShowIntelFeed(!showIntelFeed);
            }}
            className={`px-2 py-0.5 rounded font-bold transition-colors ${
              showIntelFeed ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            OSINT
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setIsIntelModeModalOpen(true);
            }}
            className="px-2 py-0.5 text-purple-300 font-bold flex items-center gap-1 hover:text-white"
          >
            <span>● NETWORK</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          <button className="px-2 py-0.5 text-emerald-400 font-bold bg-emerald-950/40 rounded border border-emerald-500/30">
            2D
          </button>
          <button
            onClick={() => onOpenEditorial()}
            className="px-2 py-0.5 text-slate-400 hover:text-cyan-400 transition-colors"
          >
            EDITORIAL
          </button>
        </div>

        {/* Right Telemetry & Status Badges */}
        <div className="flex items-center gap-3">
          {/* Numerical counters from WarMonitor screenshot: +1 (fire), 0 (crosshair), 0 (shield), 30 (radar), 229 (user) */}
          <div className="hidden md:flex items-center gap-2 text-[10px] bg-[#090d14] border border-slate-800 px-2 py-0.5 rounded">
            <span className="flex items-center gap-1 text-red-400 font-bold">
              <Flame className="w-3 h-3" /> +1
            </span>
            <span className="flex items-center gap-1 text-slate-500">
              <Crosshair className="w-3 h-3" /> 0
            </span>
            <span className="flex items-center gap-1 text-slate-500">
              <ShieldAlert className="w-3 h-3" /> 0
            </span>
            <span className="flex items-center gap-1 text-cyan-400 font-bold">
              <Radio className="w-3 h-3" /> 30
            </span>
            <span className="flex items-center gap-1 text-yellow-400 font-bold">
              <Users className="w-3 h-3" /> 229
            </span>
          </div>

          {/* Full / Oper Badge */}
          <span className="hidden sm:inline bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
            ● OPER
          </span>

          <span className="text-slate-400 text-[10px] hidden sm:inline">{clockUtc}</span>

          <button
            onClick={toggleSound}
            className="p-1 text-slate-400 hover:text-cyan-400"
            title="Audio FX"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
          </button>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-[#121924] hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 px-2.5 py-0.5 rounded text-[10px] font-bold"
          >
            IMPORT
          </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE: MAP VIEWPORT WITH FLOATING DRAGGABLE HUD PANELS */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* Underlying Full-Canvas Tactical Vector Map */}
        <div className="absolute inset-0 z-0">
          <RajasthanMap
            districts={districts}
            connections={connections}
            selectedDistrict={selectedDistrict}
            onSelectDistrict={d => {
              setSelectedDistrict(d);
              const p = posts.find(post => post.districtId === d.id);
              if (p) setSelectedPost(p);
            }}
            activeCategory={activeCategory}
          />
        </div>

        {/* FLOATING HUD WINDOW 1: THREAT / OUTBREAK ALERT (Top Left, as on WarMonitor) */}
        <AnimatePresence>
          {showOutbreakAlert && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute top-3 left-3 z-20 w-80 sm:w-96 bg-[#060a10]/95 backdrop-blur-md border border-red-500/40 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8),0_0_20px_rgba(255,59,48,0.2)]"
            >
              <div className="bg-red-950/40 px-3 py-2 border-b border-red-500/30 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-red-400 font-bold">
                  <Flame className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                  <span>NARCOTICS OUTBREAK ALERT ●</span>
                </div>
                <button
                  onClick={() => setShowOutbreakAlert(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-3.5 space-y-3 text-[11px]">
                <div>
                  <div className="text-white font-bold text-xs">
                    Sri Ganganagar — Bikaner Chitta & Synthetic Opioid Nexus
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Cross-border consignment active · Telegram drops reported March 2026
                  </div>
                </div>

                {/* 3 Metrics Boxes */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#0b1018] p-2 rounded border border-slate-800">
                    <div className="text-red-400 font-black text-sm">8</div>
                    <div className="text-[9px] text-slate-500">CASES</div>
                  </div>
                  <div className="bg-[#0b1018] p-2 rounded border border-slate-800">
                    <div className="text-amber-400 font-black text-sm">3</div>
                    <div className="text-[9px] text-slate-500">SEIZURES</div>
                  </div>
                  <div className="bg-[#0b1018] p-2 rounded border border-slate-800">
                    <div className="text-cyan-400 font-black text-sm">1</div>
                    <div className="text-[9px] text-slate-500">CRITICAL</div>
                  </div>
                </div>

                {/* Dialect / Slang Detection Guidelines */}
                <div className="bg-[#03060a] p-2.5 rounded border border-slate-800/80 space-y-1.5 text-[10px]">
                  <div className="text-amber-400 font-bold">DETECTED HINGLISH SLANG TRIGGERS:</div>
                  <div className="text-slate-300">
                    • "Pure white 5g score available", "afeem border consignment"
                  </div>
                  <div className="text-slate-300">
                    • Escrow channel: <span className="text-cyan-300">bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq</span>
                  </div>
                  <div className="text-emerald-400 font-semibold pt-1 border-t border-slate-800">
                    RECOMMENDED POLICE ACTION: Issue bank freeze under CrPC Sec 102
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FLOATING HUD WINDOW 2: PRAHARI INTEL FEED (Middle Left, as on WarMonitor) */}
        <AnimatePresence>
          {showIntelFeed && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute top-3 left-[21rem] sm:left-[26rem] z-20 w-80 sm:w-96 max-h-[70vh] bg-[#070b12]/95 backdrop-blur-md border border-amber-500/40 rounded-xl overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="bg-[#0b111a] px-3 py-2 border-b border-slate-800 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <span>◆ PRAHARI INTEL FEED</span>
                  <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-[9px] px-1.5 py-0.2 rounded font-bold">
                    ● LIVE
                  </span>
                </div>
                <button
                  onClick={() => setShowIntelFeed(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Feed Filter Tabs */}
              <div className="px-3 pt-2 bg-[#090d16] border-b border-slate-800/80 flex items-center gap-3 text-[10px] text-slate-400">
                {(['OSINT', 'TELEGRAM', 'DISTRICT', 'CYBER'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => {
                      sound.playClick();
                      setActiveFeedTab(tab);
                    }}
                    className={`pb-1.5 font-bold transition-colors ${
                      activeFeedTab === tab ? 'text-amber-400 border-b-2 border-amber-400' : 'hover:text-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Search input with Ask AI button */}
              <div className="p-2.5 bg-[#05080e] border-b border-slate-800 flex items-center gap-1.5">
                <input
                  type="text"
                  value={feedSearch}
                  onChange={e => setFeedSearch(e.target.value)}
                  placeholder="Ask AI about OSINT / Telegram..."
                  className="flex-1 bg-[#090e18] border border-slate-700 rounded px-2.5 py-1 text-slate-200 text-[11px] focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={() => sound.playRadarPing()}
                  className="bg-amber-500 hover:bg-amber-400 text-black px-2.5 py-1 rounded text-[10px] font-bold"
                >
                  ► ASK
                </button>
              </div>

              {/* Intercept cards scroll list */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-80">
                {posts.map(p => {
                  const isSelected = selectedPost?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        sound.playClick();
                        setSelectedPost(p);
                        setShowPoiDossier(true);
                      }}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#121c2b] border-cyan-400 shadow-[0_0_12px_rgba(0,229,255,0.2)]'
                          : 'bg-[#090e17] border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-cyan-400 font-bold">{p.channel}</span>
                        <span className="text-red-400 font-bold">{(p.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <p className="text-slate-300 font-sans text-[11px] leading-snug line-clamp-2">
                        "{p.rawText}"
                      </p>
                      <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1.5 pt-1 border-t border-slate-800/60">
                        <span>{p.districtName}</span>
                        <span>{p.entities.upis[0] || p.entities.phones[0] || 'FLAGGED'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FLOATING HUD WINDOW 3: PERSONS OF INTEREST / DOSSIER (Right Side, as on WarMonitor) */}
        <AnimatePresence>
          {showPoiDossier && selectedPost && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute top-3 right-3 z-20 w-84 sm:w-96 max-h-[85vh] bg-[#070a10]/95 backdrop-blur-md border border-red-500/40 rounded-xl overflow-hidden shadow-2xl flex flex-col font-mono"
            >
              {/* Header */}
              <div className="bg-[#0d121c] p-3 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-400 font-bold">⌘ RAJESH KUMAR (@seller_raj)</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="bg-red-950 text-red-400 border border-red-800 px-1.5 py-0.2 rounded text-[9px] font-bold">
                      ACTIVE SYNDICATE
                    </span>
                    <span className="bg-slate-900 text-slate-400 border border-slate-800 px-1.5 py-0.2 rounded text-[9px]">
                      DISPUTED
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowPoiDossier(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs: CONNECTIONS, TIMELINE, NETWORK, FORENSIC (SEC 65B) */}
              <div className="bg-[#090e16] px-3 pt-2 border-b border-slate-800 flex items-center gap-3 text-[10px] text-slate-400">
                {(['CONNECTIONS', 'TIMELINE', 'NETWORK', 'FORENSIC'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => {
                      sound.playClick();
                      setActivePoiTab(tab);
                    }}
                    className={`pb-1.5 font-bold transition-colors ${
                      activePoiTab === tab ? 'text-cyan-400 border-b-2 border-cyan-400' : 'hover:text-slate-200'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              <div className="p-3.5 space-y-3 overflow-y-auto flex-1 text-[11px]">
                {activePoiTab === 'CONNECTIONS' && (
                  <>
                    {/* Hero Identifier Nexus Box */}
                    <div className="p-3 bg-[#0d1522] border border-cyan-400 rounded-lg space-y-1">
                      <div className="flex items-center justify-between text-cyan-400 font-bold text-[10px]">
                        <span>🔗 HERO LINK IDENTIFIER</span>
                        <span className="text-emerald-400">● CROSS-CHANNEL NEXUS</span>
                      </div>
                      <div className="text-white font-bold text-xs">raj.pay@oksbi</div>
                      <p className="text-slate-400 text-[10px] leading-relaxed">
                        Appears simultaneously in narcotics ads (@delhi_highs in Jaipur) and mule account distribution (@mule_bazaar in Jodhpur).
                      </p>
                    </div>

                    {/* Tier 1 - Family / Cartel */}
                    <div className="space-y-1">
                      <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider">
                        TIER 1 — CARTEL LEADERSHIP
                      </div>
                      <div className="p-2.5 bg-[#090d14] rounded border border-slate-800">
                        <div className="text-white font-bold">@seller_raj (Telegram Admin)</div>
                        <div className="text-slate-400 text-[10px]">Primary handler for cross-border narcotics and forged IDs</div>
                      </div>
                    </div>

                    {/* Tier 2 - Intelligence & Brokers */}
                    <div className="space-y-1">
                      <div className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                        TIER 2 — BROKERS & CONDUITS
                      </div>
                      <div className="space-y-1.5">
                        <div className="p-2 bg-[#090d14] rounded border border-slate-800 flex justify-between items-center">
                          <div>
                            <div className="text-slate-200 font-bold">Phone: +91 9876543210</div>
                            <div className="text-slate-500 text-[9px]">Alwar / Kota WhatsApp orders</div>
                          </div>
                          <span className="text-amber-400 text-[9px] font-bold">ARMS CONDUIT</span>
                        </div>

                        <div className="p-2 bg-[#090d14] rounded border border-slate-800 flex justify-between items-center">
                          <div>
                            <div className="text-slate-200 font-bold">BTC: bc1qar0s...mdq</div>
                            <div className="text-slate-500 text-[9px]">Sri Ganganagar Escrow</div>
                          </div>
                          <span className="text-red-400 text-[9px] font-bold">CRYPTO ESCROW</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {activePoiTab === 'FORENSIC' && (
                  <div className="space-y-3">
                    <div className="p-2.5 bg-cyan-950/30 border border-cyan-500/40 rounded text-[10px] text-cyan-300">
                      ✓ SECTION 65B INDIAN EVIDENCE ACT CERTIFIED TRANSCRIPT
                    </div>

                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-500">RAW TRANSCRIPT:</div>
                      <div className="p-2.5 bg-[#05080e] rounded border border-slate-800 text-slate-200 font-sans text-xs">
                        "{selectedPost.rawText}"
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-500">SHA-256 INTEGRITY HASH:</div>
                      <div className="p-2.5 bg-slate-950 rounded border border-cyan-500/40 text-cyan-300 text-[10px] break-all leading-tight">
                        {selectedPost.sha256}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <button
                        onClick={() => handleCopyHash(selectedPost.sha256)}
                        className="w-full flex items-center justify-center gap-2 bg-[#101724] hover:bg-slate-800 border border-cyan-500/50 text-cyan-400 py-2 rounded font-bold"
                      >
                        {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedHash ? 'HASH COPIED!' : 'COPY SHA-256 HASH'}</span>
                      </button>

                      <button
                        onClick={() => handleDownloadPDF(selectedPost)}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 text-white py-2 rounded font-bold shadow-[0_0_15px_rgba(255,59,48,0.35)]"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>DOWNLOAD SECTION 65B PDF</span>
                      </button>
                    </div>
                  </div>
                )}

                {(activePoiTab === 'TIMELINE' || activePoiTab === 'NETWORK') && (
                  <div className="space-y-2 text-slate-400 text-xs">
                    <div className="p-2.5 bg-[#090d14] rounded border border-slate-800">
                      <div className="text-cyan-400 font-bold">13:04 UTC — Intercept @delhi_highs</div>
                      <p className="text-[10px] text-slate-400 mt-1">Payment initiated to raj.pay@oksbi</p>
                    </div>
                    <div className="p-2.5 bg-[#090d14] rounded border border-slate-800">
                      <div className="text-amber-400 font-bold">13:01 UTC — Intercept @mule_bazaar</div>
                      <p className="text-[10px] text-slate-400 mt-1">KYC account listed with same UPI handle</p>
                    </div>
                    <div className="p-2.5 bg-[#090d14] rounded border border-slate-800">
                      <div className="text-red-400 font-bold">11:45 UTC — Intercept @rajasthan_arms_hub</div>
                      <p className="text-[10px] text-slate-400 mt-1">Alwar border drop brokered by linked phone</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FLOATING TOAST: TELEGRAM LAUNCHED (Top Right, as in WarMonitor screenshot frame_13) */}
        <AnimatePresence>
          {showTelegramToast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-3 right-3 sm:right-96 mr-3 z-30 w-72 bg-[#090f18]/95 backdrop-blur-md border border-cyan-500/40 rounded-xl p-3 shadow-2xl text-[11px]"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                  <Radio className="w-3.5 h-3.5" />
                  <span>TELEGRAM DAEMON ONLINE</span>
                </div>
                <button onClick={() => setShowTelegramToast(false)} className="text-slate-500 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <p className="text-slate-300 text-[10px] mt-1.5 leading-snug">
                Public Telegram feed daemon streaming real-time alerts, OSINT drops & tactical intercepts across Rajasthan.
              </p>
              <div className="mt-2.5 flex items-center justify-between">
                <button
                  onClick={() => {
                    sound.playClick();
                    setIsUploadModalOpen(true);
                  }}
                  className="bg-cyan-500 hover:bg-cyan-400 text-black px-2.5 py-1 rounded text-[9px] font-bold"
                >
                  IMPORT FEED NOW
                </button>
                <button
                  onClick={() => setShowTelegramToast(false)}
                  className="text-slate-500 hover:text-slate-300 text-[9px]"
                >
                  Don't show again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CENTER BOTTOM CIRCULAR HUD DOCK (As in WarMonitor frame_12) */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#070b12]/90 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-full shadow-2xl">
          <button
            onClick={() => {
              sound.playClick();
              setShowIntelFeed(!showIntelFeed);
            }}
            className="w-8 h-8 rounded-full bg-[#0d1420] hover:bg-cyan-950 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-cyan-400 transition-colors"
            title="Toggle Intel Feed"
          >
            🌐
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setShowOutbreakAlert(!showOutbreakAlert);
            }}
            className="w-8 h-8 rounded-full bg-[#0d1420] hover:bg-red-950 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors"
            title="Toggle Outbreak Alert"
          >
            ⚠️
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setShowPoiDossier(!showPoiDossier);
            }}
            className="w-8 h-8 rounded-full bg-[#0d1420] hover:bg-purple-950 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-purple-400 transition-colors"
            title="Toggle POI Dossier"
          >
            👥
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setIsIntelModeModalOpen(true);
            }}
            className="w-8 h-8 rounded-full bg-[#0d1420] hover:bg-amber-950 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-amber-400 transition-colors"
            title="Intel Modes"
          >
            ⭐
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          <div className="flex items-center gap-1 text-[9px] bg-slate-900 border border-slate-700 px-2 py-1 rounded-full text-slate-400">
            <span className="text-cyan-400 font-bold">EARTH</span>
            <span>|</span>
            <span className="hover:text-white cursor-pointer">TACTICAL</span>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM TELEMETRY TICKER & COLLAPSIBLE ANALYSIS DRAWER */}
      <div className="shrink-0 bg-[#06090e] border-t border-slate-800 z-30 font-mono">
        {/* Real-time Ticker Strip (Hawala USDT, Gold, BTC, Flagged Intercepts as on WarMonitor) */}
        <div className="px-3 py-1.5 bg-[#04070a] border-b border-slate-800/80 flex items-center justify-between text-[10px] overflow-x-auto whitespace-nowrap gap-4">
          <div className="flex items-center gap-5">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              HAWALA USDT ₹88.40 <span className="text-[9px]">▲+0.8%</span>
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              GOLD ₹74,200/10g <span className="text-[9px]">▲+0.8%</span>
            </span>
            <span className="text-cyan-400 font-bold flex items-center gap-1">
              UPI MULE VOL ₹4.2Cr <span className="text-[9px]">▲+1.2%</span>
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              BTC $97,412 <span className="text-[9px]">▲+2.1%</span>
            </span>
            <span className="text-red-400 font-bold flex items-center gap-1">
              FLAGGED INTERCEPTS 8,942 <span className="text-[9px]">▲+0.4%</span>
            </span>
            <span className="text-slate-400">
              VIX 18.32 <span className="text-red-400 text-[9px]">▼-1.2%</span>
            </span>
          </div>

          <button
            onClick={() => setShowBottomDrawer(!showBottomDrawer)}
            className="flex items-center gap-1 text-slate-400 hover:text-cyan-400 text-[10px]"
          >
            <span>ANALYZE RAJASTHAN</span>
            {showBottomDrawer ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Collapsible Analysis Drawer (As in WarMonitor frame_12) */}
        {showBottomDrawer && (
          <div className="p-3 bg-[#070b12] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-3">
                <span className="text-white font-bold text-xs flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  ANALYZE: {selectedDistrict?.name.toUpperCase() || 'JAIPUR'}
                </span>
                <button
                  onClick={() => {
                    sound.playClick();
                    setIsIntelModeModalOpen(true);
                  }}
                  className="text-cyan-400 hover:underline text-[10px]"
                >
                  ◆ CHANGE DISTRICT
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => sound.playRadarPing()}
                  className="bg-cyan-500 hover:bg-cyan-400 text-black px-3 py-1 rounded text-[10px] font-bold"
                >
                  SCAN {selectedDistrict?.name.toUpperCase() || 'JAIPUR'}
                </button>
              </div>
            </div>

            {/* Rajasthan Threat Monitor Table */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* Hotspot district meters (8 cols) */}
              <div className="md:col-span-8 space-y-2">
                <div className="text-[10px] text-amber-400 font-bold flex items-center gap-1.5">
                  <span>RAJASTHAN THREAT MONITOR ●</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                  <div className="p-2 bg-[#0a0f16] rounded border border-slate-800 flex items-center justify-between">
                    <span>Jaipur Syndicate Activity</span>
                    <span className="text-red-400 font-bold">8/10 CRITICAL</span>
                  </div>
                  <div className="p-2 bg-[#0a0f16] rounded border border-slate-800 flex items-center justify-between">
                    <span>Alwar Arms Conduit</span>
                    <span className="text-amber-400 font-bold">7/10 HIGH</span>
                  </div>
                  <div className="p-2 bg-[#0a0f16] rounded border border-slate-800 flex items-center justify-between">
                    <span>Sri Ganganagar Border Drops</span>
                    <span className="text-red-400 font-bold">6/10 CRITICAL</span>
                  </div>
                  <div className="p-2 bg-[#0a0f16] rounded border border-slate-800 flex items-center justify-between">
                    <span>Jodhpur Mule Account Nexus</span>
                    <span className="text-emerald-400 font-bold">5/10 ELEVATED</span>
                  </div>
                </div>
              </div>

              {/* Aggregated Stat Boxes (4 cols) */}
              <div className="md:col-span-4 grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="p-2 bg-[#0a0f16] rounded border border-slate-800">
                  <div className="text-slate-400 text-[9px]">SUSPECTS</div>
                  <div className="text-white font-bold text-xs mt-0.5">~40,000</div>
                </div>
                <div className="p-2 bg-[#0a0f16] rounded border border-slate-800">
                  <div className="text-slate-400 text-[9px]">MULE ACCTS</div>
                  <div className="text-cyan-400 font-bold text-xs mt-0.5">~120K</div>
                </div>
                <div className="p-2 bg-[#0a0f16] rounded border border-slate-800">
                  <div className="text-slate-400 text-[9px]">SEIZED VALUE</div>
                  <div className="text-emerald-400 font-bold text-xs mt-0.5">₹200M+</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FLOATING ACTION PILLS (Bottom Right as in WarMonitor) */}
      <div className="fixed bottom-12 right-3 z-40 flex items-center gap-2">
        <button
          onClick={() => {
            sound.playClick();
            setShowIntelFeed(true);
          }}
          className="bg-[#0b121c]/90 hover:bg-[#101b2a] border border-emerald-500/50 text-emerald-300 px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-xl transition-all"
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
          <span>CHAT WITH OPERATORS / 0 LIVE</span>
        </button>

        <button
          onClick={() => {
            sound.playSuccessChime();
            setIsUploadModalOpen(true);
          }}
          className="bg-emerald-500 hover:bg-emerald-400 text-black px-3.5 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all"
        >
          <Camera className="w-3.5 h-3.5 fill-black" />
          <span>CAPTURE INTEL</span>
        </button>
      </div>

      {/* Intel Mode Modal */}
      <IntelModeModal
        isOpen={isIntelModeModalOpen}
        onClose={() => setIsIntelModeModalOpen(false)}
        onSelectMode={mode => {
          if (mode === 'NARCOTICS') {
            setShowOutbreakAlert(true);
            setActiveCategory('DRUGS');
          } else if (mode === 'POI') {
            setShowPoiDossier(true);
          }
        }}
      />

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onIngestPosts={newPosts => {
          setPosts(prev => [...newPosts, ...prev]);
          if (newPosts.length > 0) setSelectedPost(newPosts[0]);
        }}
      />
    </div>
  );
};
