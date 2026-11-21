import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  Shield,
  Radio,
  Biohazard,
  Network,
  Lock,
  Clock,
  Search,
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
  MapPin,
  Sparkles,
} from 'lucide-react';
import { RajasthanMap } from './RajasthanMap';
import { IntelModeModal } from './IntelModeModal';
import { UploadModal } from './UploadModal';
import { InterceptPost, DistrictIntel, CrimeCategory, DistrictConnection } from '../types';
import {
  RAJASTHAN_DISTRICTS,
  DISTRICT_CONNECTIONS,
  INITIAL_INTERCEPTS,
} from '../data/mockData';
import { sound } from '../utils/audio';
import { generateDossierPDF } from '../utils/pdfGenerator';

interface WarMonitorLiveAppProps {
  onOpenEditorial: () => void;
}

export const WarMonitorLiveApp: React.FC<WarMonitorLiveAppProps> = ({ onOpenEditorial }) => {
  const [posts, setPosts] = useState<InterceptPost[]>(INITIAL_INTERCEPTS);
  const [districts, setDistricts] = useState<DistrictIntel[]>(RAJASTHAN_DISTRICTS);
  const [connections, setConnections] = useState<DistrictConnection[]>(DISTRICT_CONNECTIONS);
  const [selectedPost, setSelectedPost] = useState<InterceptPost | null>(INITIAL_INTERCEPTS[0]);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictIntel | null>(
    RAJASTHAN_DISTRICTS[0]
  );

  // Floating HUD windows toggles
  const [showOutbreakAlert, setShowOutbreakAlert] = useState(true);
  const [showIntelFeed, setShowIntelFeed] = useState(true);
  const [showPoiDossier, setShowPoiDossier] = useState(true);
  const [showTelegramToast, setShowTelegramToast] = useState(true);
  const [showBottomDrawer, setShowBottomDrawer] = useState(true);
  const [isIntelModeModalOpen, setIsIntelModeModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Active state filters
  const [activeCategory, setActiveCategory] = useState<CrimeCategory | 'ALL'>('ALL');
  const [activePoiTab, setActivePoiTab] = useState<
    'CONNECTIONS' | 'TIMELINE' | 'NETWORK' | 'FORENSIC'
  >('CONNECTIONS');
  const [activeFeedTab, setActiveFeedTab] = useState<
    'OSINT' | 'TELEGRAM' | 'DISTRICT' | 'CYBER'
  >('TELEGRAM');
  const [feedSearch, setFeedSearch] = useState('');
  const [copiedHash, setCopiedHash] = useState(false);
  const [isMuted, setIsMuted] = useState(!sound.enabled);
  const [clockUtc, setClockUtc] = useState('');

  // Clock formatted in UTC
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
    <div className="h-screen w-screen bg-[#070A10] text-slate-100 flex flex-col overflow-hidden font-sans select-none relative">
      {/* 1. PALANTIR / LINEAR 52PX SINGLE-ROW GLASS TOPBAR */}
      <header className="h-[52px] bg-[#070A10]/80 backdrop-blur-md border-b border-white/[0.07] px-4 flex items-center justify-between z-30 shrink-0">
        {/* Left Section: Menu, Branding & Refined Mode Pill */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sound.playClick();
              setIsIntelModeModalOpen(true);
            }}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
            title="Open Intel Modes"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Logo & Platform Name */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
            <span className="font-sans font-bold text-sm tracking-tight text-white">
              PRAHARI
            </span>
          </div>

          <div className="h-4 w-px bg-white/[0.08]" />

          {/* Refined Mode Pill */}
          <button
            onClick={() => {
              sound.playClick();
              setIsIntelModeModalOpen(true);
            }}
            className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300 text-xs font-sans font-medium transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="truncate max-w-[260px]">
              Rajasthan Cross-Channel OSINT
            </span>
          </button>
        </div>

        {/* Center: Subtle, Borderless Metric Blocks with Faint Dividers */}
        <div className="hidden lg:flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-sans">Channels:</span>
            <span className="font-mono font-medium text-slate-200">1,428</span>
          </div>

          <div className="h-3.5 w-px bg-white/[0.08]" />

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-sans">Intercepts:</span>
            <span className="font-mono font-medium text-slate-200">
              {(posts.length + 8940).toLocaleString()}
            </span>
          </div>

          <div className="h-3.5 w-px bg-white/[0.08]" />

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-sans">Entities:</span>
            <span className="font-mono font-medium text-slate-200">3,114</span>
          </div>

          <div className="h-3.5 w-px bg-white/[0.08]" />

          {/* Refined Soft Status Pill (replacing loud red DEFCON box) */}
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px] font-sans font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Defcon 2 · Elevated</span>
          </div>
        </div>

        {/* Right Section: Toggles, Audio, Import, Return */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              sound.playClick();
              setShowIntelFeed(!showIntelFeed);
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-sans font-medium transition-colors ${
              showIntelFeed
                ? 'bg-white/[0.08] text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Signals
          </button>

          <button
            onClick={() => onOpenEditorial()}
            className="px-2.5 py-1 rounded-md text-xs font-sans font-medium text-slate-400 hover:text-white transition-colors"
          >
            Editorial
          </button>

          <div className="h-4 w-px bg-white/[0.08] hidden sm:block" />

          <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">
            {clockUtc}
          </span>

          <button
            onClick={toggleSound}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"
            title="Toggle Audio"
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-slate-300" />
            )}
          </button>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-slate-200 px-3 py-1 rounded-lg text-xs font-sans font-medium transition-colors"
          >
            Import
          </button>
        </div>
      </header>

      {/* 2. MAP VIEWPORT & PALANTIR GOTHAM FLOATING HUD PANELS */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* Full-bleed Mapbox Dark Vector Map Canvas */}
        <div className="absolute inset-0 z-0">
          <RajasthanMap
            districts={districts}
            connections={connections}
            selectedDistrict={selectedDistrict}
            onSelectDistrict={(d) => {
              setSelectedDistrict(d);
              const p = posts.find((post) => post.districtId === d.id);
              if (p) setSelectedPost(p);
            }}
            activeCategory={activeCategory}
          />
        </div>

        {/* FLOATING WINDOW 1: THREAT / OUTBREAK ALERT (Top-Left) */}
        <AnimatePresence>
          {showOutbreakAlert && (
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="absolute top-3.5 left-4 z-20 w-80 sm:w-92 bg-[#0C101A]/90 backdrop-blur-xl border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl"
            >
              <div className="px-3.5 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-400 font-sans font-semibold text-xs">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <span>Narcotics Outbreak Alert</span>
                </div>
                <button
                  onClick={() => setShowOutbreakAlert(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-3.5 space-y-3 font-sans text-xs">
                <div>
                  <div className="text-white font-medium text-xs leading-snug">
                    Sri Ganganagar — Bikaner Chitta & Synthetic Opioid Nexus
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Cross-border drops reported active via Telegram channels
                  </div>
                </div>

                {/* 3 Metric Blocks */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/[0.02] p-2 rounded-lg border border-white/[0.05]">
                    <div className="text-rose-400 font-mono font-bold text-sm">8</div>
                    <div className="text-[10px] text-slate-400 uppercase">Cases</div>
                  </div>
                  <div className="bg-white/[0.02] p-2 rounded-lg border border-white/[0.05]">
                    <div className="text-amber-400 font-mono font-bold text-sm">3</div>
                    <div className="text-[10px] text-slate-400 uppercase">Seizures</div>
                  </div>
                  <div className="bg-white/[0.02] p-2 rounded-lg border border-white/[0.05]">
                    <div className="text-cyan-400 font-mono font-bold text-sm">1</div>
                    <div className="text-[10px] text-slate-400 uppercase">Critical</div>
                  </div>
                </div>

                {/* Dialect Guidance */}
                <div className="bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.05] space-y-1.5 text-[11px]">
                  <div className="text-slate-400 font-medium">Slang Triggers:</div>
                  <div className="text-slate-300">
                    • "Pure white 5g score", "afeem border consignment"
                  </div>
                  <div className="text-slate-400 font-mono text-[10px]">
                    Escrow: <span className="text-cyan-300">bc1qar0s...mdq</span>
                  </div>
                  <div className="text-emerald-400 font-medium pt-1 border-t border-white/[0.05]">
                    Action: Issue freeze order under CrPC Sec 102
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FLOATING WINDOW 2: PRAHARI SIGNALS FEED (Center-Left) */}
        <AnimatePresence>
          {showIntelFeed && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="absolute top-3.5 left-[21.5rem] sm:left-[25.5rem] z-20 w-80 sm:w-92 max-h-[72vh] bg-[#0C101A]/90 backdrop-blur-xl border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl flex flex-col font-sans"
            >
              {/* Header */}
              <div className="px-3.5 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span className="font-semibold text-xs text-white">Signals Feed</span>
                  <span className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] px-1.5 py-0.2 rounded font-mono">
                    Live
                  </span>
                </div>
                <button
                  onClick={() => setShowIntelFeed(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Feed Tabs */}
              <div className="px-3.5 pt-2 bg-white/[0.01] border-b border-white/[0.05] flex items-center gap-3 text-xs text-slate-400">
                {(['OSINT', 'TELEGRAM', 'DISTRICT', 'CYBER'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      sound.playClick();
                      setActiveFeedTab(tab);
                    }}
                    className={`pb-2 font-medium transition-colors ${
                      activeFeedTab === tab
                        ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
                        : 'hover:text-slate-200'
                    }`}
                  >
                    {tab.charAt(0) + tab.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="p-2.5 border-b border-white/[0.05] flex items-center gap-1.5">
                <input
                  type="text"
                  value={feedSearch}
                  onChange={(e) => setFeedSearch(e.target.value)}
                  placeholder="Ask intelligence assistant..."
                  className="flex-1 bg-white/[0.02] border border-white/[0.08] rounded-md px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  onClick={() => sound.playRadarPing()}
                  className="bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 px-2.5 py-1 rounded-md text-xs font-medium"
                >
                  Ask
                </button>
              </div>

              {/* Cards List */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2 max-h-80">
                {posts.map((p) => {
                  const isSelected = selectedPost?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        sound.playClick();
                        setSelectedPost(p);
                        setShowPoiDossier(true);
                      }}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-white/[0.06] border-cyan-500/40 shadow-sm'
                          : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-mono font-medium text-slate-200">
                          {p.channel}
                        </span>
                        <span className="font-mono text-[10px] text-cyan-400 font-semibold">
                          {(p.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-slate-300 font-sans text-xs leading-snug line-clamp-2">
                        "{p.rawText}"
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5 pt-1 border-t border-white/[0.04]">
                        <span>{p.districtName}</span>
                        <span className="font-mono text-slate-400">
                          {p.entities.upis[0] || p.entities.phones[0] || 'FLAGGED'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FLOATING WINDOW 3: PERSONS OF INTEREST DOSSIER (Right Side) */}
        <AnimatePresence>
          {showPoiDossier && selectedPost && (
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              className="absolute top-3.5 right-4 z-20 w-84 sm:w-96 max-h-[85vh] bg-[#0C101A]/90 backdrop-blur-xl border border-white/[0.08] rounded-xl overflow-hidden shadow-2xl flex flex-col font-sans"
            >
              {/* Header */}
              <div className="p-3.5 border-b border-white/[0.06] flex items-center justify-between">
                <div>
                  <div className="text-white font-semibold text-xs flex items-center gap-2">
                    <span>Rajesh Kumar</span>
                    <span className="font-mono text-cyan-400 text-[11px]">(@seller_raj)</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="bg-rose-500/10 text-rose-300 border border-rose-500/20 px-1.5 py-0.2 rounded text-[10px] font-medium">
                      Active Syndicate
                    </span>
                    <span className="bg-white/[0.03] text-slate-400 border border-white/[0.06] px-1.5 py-0.2 rounded text-[10px]">
                      Cross-District
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowPoiDossier(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="bg-white/[0.01] px-3.5 pt-2 border-b border-white/[0.05] flex items-center gap-3 text-xs text-slate-400">
                {(['CONNECTIONS', 'TIMELINE', 'NETWORK', 'FORENSIC'] as const).map(
                  (tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        sound.playClick();
                        setActivePoiTab(tab);
                      }}
                      className={`pb-2 font-medium transition-colors ${
                        activePoiTab === tab
                          ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
                          : 'hover:text-slate-200'
                      }`}
                    >
                      {tab.charAt(0) + tab.slice(1).toLowerCase()}
                    </button>
                  )
                )}
              </div>

              {/* Tab Contents */}
              <div className="p-3.5 space-y-3 overflow-y-auto flex-1 text-xs">
                {activePoiTab === 'CONNECTIONS' && (
                  <>
                    {/* Hero Identifier Nexus Box */}
                    <div className="p-3 bg-white/[0.02] border border-cyan-500/30 rounded-lg space-y-1">
                      <div className="flex items-center justify-between text-cyan-400 text-[10px] font-semibold">
                        <span>HERO LINK IDENTIFIER</span>
                        <span className="text-emerald-400">● Verified Nexus</span>
                      </div>
                      <div className="text-white font-mono font-medium text-xs">
                        raj.pay@oksbi
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Appears simultaneously in narcotics drops (@delhi_highs) and mule account
                        conduits (@mule_bazaar).
                      </p>
                    </div>

                    {/* Tier 1 - Leadership */}
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                        Tier 1 — Cartel Leadership
                      </div>
                      <div className="p-2.5 bg-white/[0.02] rounded-lg border border-white/[0.05]">
                        <div className="text-slate-200 font-medium">@seller_raj (Telegram Admin)</div>
                        <div className="text-slate-400 text-[11px]">Primary handler for narcotics and forged IDs</div>
                      </div>
                    </div>

                    {/* Tier 2 - Brokers */}
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                        Tier 2 — Brokers & Conduits
                      </div>
                      <div className="space-y-1.5">
                        <div className="p-2 bg-white/[0.02] rounded-lg border border-white/[0.05] flex justify-between items-center">
                          <div>
                            <div className="text-slate-200 font-mono text-[11px] font-medium">
                              Tel: +91 9876543210
                            </div>
                            <div className="text-slate-500 text-[10px]">Alwar / Kota WhatsApp orders</div>
                          </div>
                          <span className="text-amber-400 font-sans text-[10px]">Arms Broker</span>
                        </div>

                        <div className="p-2 bg-white/[0.02] rounded-lg border border-white/[0.05] flex justify-between items-center">
                          <div>
                            <div className="text-slate-200 font-mono text-[11px] font-medium">
                              BTC: bc1qar0s...mdq
                            </div>
                            <div className="text-slate-500 text-[10px]">Border Narcotics Escrow</div>
                          </div>
                          <span className="text-rose-400 font-sans text-[10px]">Crypto Escrow</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {activePoiTab === 'FORENSIC' && (
                  <div className="space-y-3 font-sans">
                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[11px] text-emerald-300">
                      ✓ Section 65B Indian Evidence Act Certified Transcript
                    </div>

                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        Raw Transcript:
                      </div>
                      <div className="p-2.5 bg-white/[0.02] rounded-lg border border-white/[0.05] text-slate-200 text-xs">
                        "{selectedPost.rawText}"
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        SHA-256 Checksum:
                      </div>
                      <div className="p-2.5 bg-white/[0.02] rounded-lg border border-white/[0.06] text-cyan-300 font-mono text-[10px] break-all">
                        {selectedPost.sha256}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <button
                        onClick={() => handleCopyHash(selectedPost.sha256)}
                        className="w-full flex items-center justify-center gap-2 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-slate-200 py-2 rounded-lg font-medium transition-all"
                      >
                        {copiedHash ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>{copiedHash ? 'Hash Copied' : 'Copy SHA-256 Hash'}</span>
                      </button>

                      <button
                        onClick={() => handleDownloadPDF(selectedPost)}
                        className="w-full flex items-center justify-center gap-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 py-2 rounded-lg font-medium transition-all"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Download Section 65B PDF</span>
                      </button>
                    </div>
                  </div>
                )}

                {(activePoiTab === 'TIMELINE' || activePoiTab === 'NETWORK') && (
                  <div className="space-y-2 text-slate-400 text-xs">
                    <div className="p-2.5 bg-white/[0.02] rounded-lg border border-white/[0.05]">
                      <div className="text-cyan-400 font-medium">13:04 UTC — Intercept @delhi_highs</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">Payment advance routed to raj.pay@oksbi</p>
                    </div>
                    <div className="p-2.5 bg-white/[0.02] rounded-lg border border-white/[0.05]">
                      <div className="text-amber-400 font-medium">13:01 UTC — Intercept @mule_bazaar</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">Mule account offered under identical handle</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FLOATING TOAST: TELEGRAM LAUNCHED (Subtle notification) */}
        <AnimatePresence>
          {showTelegramToast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-3.5 right-4 sm:right-[26rem] z-30 w-72 bg-[#0C101A]/90 backdrop-blur-xl border border-white/[0.08] rounded-xl p-3 shadow-2xl text-xs font-sans"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-1.5 text-cyan-400 font-medium">
                  <Radio className="w-3.5 h-3.5" />
                  <span>Public Telegram Stream</span>
                </div>
                <button
                  onClick={() => setShowTelegramToast(false)}
                  className="text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-slate-400 text-[11px] mt-1.5 leading-snug">
                Monitoring public broadcast channels for illicit trade across Rajasthan border districts.
              </p>
              <div className="mt-2.5 flex items-center justify-between">
                <button
                  onClick={() => {
                    sound.playClick();
                    setIsUploadModalOpen(true);
                  }}
                  className="text-cyan-400 hover:underline text-[11px] font-medium"
                >
                  Import Dataset
                </button>
                <button
                  onClick={() => setShowTelegramToast(false)}
                  className="text-slate-500 hover:text-slate-300 text-[10px]"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CENTER BOTTOM CIRCULAR HUD DOCK (Palantir/Linear translucent pill) */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-[#0C101A]/85 backdrop-blur-md border border-white/[0.08] px-2.5 py-1.5 rounded-full shadow-2xl">
          <button
            onClick={() => {
              sound.playClick();
              setShowIntelFeed(!showIntelFeed);
            }}
            className="w-7 h-7 rounded-full bg-white/[0.03] hover:bg-white/[0.08] flex items-center justify-center text-slate-300 transition-colors"
            title="Signals Feed"
          >
            🌐
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setShowOutbreakAlert(!showOutbreakAlert);
            }}
            className="w-7 h-7 rounded-full bg-white/[0.03] hover:bg-white/[0.08] flex items-center justify-center text-slate-300 transition-colors"
            title="Threat Alert"
          >
            ⚠️
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setShowPoiDossier(!showPoiDossier);
            }}
            className="w-7 h-7 rounded-full bg-white/[0.03] hover:bg-white/[0.08] flex items-center justify-center text-slate-300 transition-colors"
            title="Dossier"
          >
            👥
          </button>

          <div className="h-3.5 w-px bg-white/[0.08] mx-1" />

          <div className="flex items-center gap-1 text-[10px] bg-white/[0.02] border border-white/[0.06] px-2.5 py-0.5 rounded-full text-slate-400">
            <span className="text-cyan-400 font-medium">Earth</span>
            <span>·</span>
            <span className="hover:text-white cursor-pointer">Dark</span>
          </div>
        </div>
      </div>

      {/* 3. REFINED FINANCIAL TICKER & COLLAPSIBLE DRAWER */}
      <div className="shrink-0 bg-[#070A10] border-t border-white/[0.07] z-30 font-sans">
        {/* Subtle Market Ticker Strip */}
        <div className="px-4 py-1.5 bg-[#070A10]/95 border-b border-white/[0.04] flex items-center justify-between text-[11px] overflow-x-auto whitespace-nowrap gap-5">
          <div className="flex items-center gap-5 text-slate-400 font-mono text-[10px]">
            <span className="flex items-center gap-1">
              <span className="text-slate-500">HAWALA USDT:</span>
              <span className="text-slate-200">₹88.40</span>
              <span className="text-emerald-400">▲+0.8%</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-slate-500">GOLD:</span>
              <span className="text-slate-200">₹74,200/10g</span>
              <span className="text-emerald-400">▲+0.8%</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-slate-500">MULE VOL:</span>
              <span className="text-cyan-300 font-medium">₹4.2Cr</span>
              <span className="text-cyan-400">▲+1.2%</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-slate-500">BTC:</span>
              <span className="text-slate-200">$97,412</span>
              <span className="text-emerald-400">▲+2.1%</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-slate-500">FLAGGED INTERCEPTS:</span>
              <span className="text-rose-400 font-medium">8,948</span>
              <span className="text-rose-400">▲+0.4%</span>
            </span>
          </div>

          <button
            onClick={() => setShowBottomDrawer(!showBottomDrawer)}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-xs font-sans"
          >
            <span>District Intelligence</span>
            {showBottomDrawer ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Collapsible Analysis Drawer */}
        {showBottomDrawer && (
          <div className="p-3.5 bg-[#0C101A]/60 backdrop-blur-md space-y-3 font-sans">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] pb-2.5">
              <div className="flex items-center gap-3">
                <span className="text-white font-medium text-xs flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Analyze: {selectedDistrict?.name || 'Jaipur'}</span>
                </span>
                <button
                  onClick={() => {
                    sound.playClick();
                    setIsIntelModeModalOpen(true);
                  }}
                  className="text-cyan-400 hover:underline text-xs"
                >
                  Change District
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => sound.playRadarPing()}
                  className="bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 px-3 py-1 rounded-md text-xs font-medium border border-white/[0.08]"
                >
                  Scan {selectedDistrict?.name || 'Jaipur'}
                </button>
              </div>
            </div>

            {/* Rajasthan Threat Monitor Table */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* Meters */}
              <div className="md:col-span-8 space-y-2">
                <div className="text-xs font-medium text-slate-300">
                  Regional Risk Meters
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white/[0.02] rounded-lg border border-white/[0.05] flex items-center justify-between">
                    <span className="text-slate-300">Jaipur Syndicate Activity</span>
                    <span className="font-mono text-rose-400 font-medium">8/10 Critical</span>
                  </div>
                  <div className="p-2.5 bg-white/[0.02] rounded-lg border border-white/[0.05] flex items-center justify-between">
                    <span className="text-slate-300">Alwar Arms Conduit</span>
                    <span className="font-mono text-amber-400 font-medium">7/10 High</span>
                  </div>
                  <div className="p-2.5 bg-white/[0.02] rounded-lg border border-white/[0.05] flex items-center justify-between">
                    <span className="text-slate-300">Sri Ganganagar Border Drops</span>
                    <span className="font-mono text-rose-400 font-medium">6/10 Critical</span>
                  </div>
                  <div className="p-2.5 bg-white/[0.02] rounded-lg border border-white/[0.05] flex items-center justify-between">
                    <span className="text-slate-300">Jodhpur Mule Account Nexus</span>
                    <span className="font-mono text-cyan-400 font-medium">5/10 Elevated</span>
                  </div>
                </div>
              </div>

              {/* Aggregated Stat Boxes */}
              <div className="md:col-span-4 grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 bg-white/[0.02] rounded-lg border border-white/[0.05]">
                  <div className="text-slate-500 text-[10px] uppercase">Suspects</div>
                  <div className="text-slate-200 font-mono font-bold text-sm mt-0.5">~40K</div>
                </div>
                <div className="p-2.5 bg-white/[0.02] rounded-lg border border-white/[0.05]">
                  <div className="text-slate-500 text-[10px] uppercase">Mule Accts</div>
                  <div className="text-cyan-400 font-mono font-bold text-sm mt-0.5">~120K</div>
                </div>
                <div className="p-2.5 bg-white/[0.02] rounded-lg border border-white/[0.05]">
                  <div className="text-slate-500 text-[10px] uppercase">Seized</div>
                  <div className="text-emerald-400 font-mono font-bold text-sm mt-0.5">₹200M+</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-12 right-4 z-40 flex items-center gap-2">
        <button
          onClick={() => {
            sound.playClick();
            setShowIntelFeed(true);
          }}
          className="bg-[#0C101A]/90 hover:bg-[#141B2B] border border-white/[0.08] text-slate-300 px-3 py-1.5 rounded-full text-xs font-sans font-medium flex items-center gap-1.5 shadow-xl transition-all"
        >
          <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
          <span>Operators</span>
        </button>

        <button
          onClick={() => {
            sound.playSuccessChime();
            setIsUploadModalOpen(true);
          }}
          className="bg-white/[0.08] hover:bg-white/[0.12] text-white border border-white/[0.12] px-3.5 py-1.5 rounded-full text-xs font-sans font-medium flex items-center gap-1.5 shadow-xl transition-all"
        >
          <Camera className="w-3.5 h-3.5 text-slate-300" />
          <span>Capture Intel</span>
        </button>
      </div>

      {/* Intel Mode Modal */}
      <IntelModeModal
        isOpen={isIntelModeModalOpen}
        onClose={() => setIsIntelModeModalOpen(false)}
        onSelectMode={(mode) => {
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
        onIngestPosts={(newPosts) => {
          setPosts((prev) => [...newPosts, ...prev]);
          if (newPosts.length > 0) setSelectedPost(newPosts[0]);
        }}
      />
    </div>
  );
};
