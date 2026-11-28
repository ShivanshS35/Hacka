import React, { useState, useEffect } from 'react';
import {
  Shield,
  Radio,
  Activity,
  Layers,
  Database,
  Volume2,
  VolumeX,
  Upload,
  ArrowLeft,
  Sparkles,
  Zap,
  MapPin,
  Clock,
  Cpu
} from 'lucide-react';
import { RajasthanMap } from './RajasthanMap';
import { LiveInterceptFeed } from './LiveInterceptFeed';
import { InspectorPanel } from './InspectorPanel';
import { UploadModal } from './UploadModal';
import { InterceptPost, DistrictIntel, CrimeCategory, DistrictConnection } from '../types';
import { RAJASTHAN_DISTRICTS, DISTRICT_CONNECTIONS, INITIAL_INTERCEPTS } from '../data/mockData';
import { sound } from '../utils/audio';
import { classifyText, generateSHA256 } from '../utils/detectionEngine';

interface CommandCenterProps {
  onReturnToEditorial: () => void;
  initialTab?: 'GRAPH' | 'DOSSIER' | 'MAP';
}

export const CommandCenter: React.FC<CommandCenterProps> = ({
  onReturnToEditorial
}) => {
  const [posts, setPosts] = useState<InterceptPost[]>(INITIAL_INTERCEPTS);
  const [districts, setDistricts] = useState<DistrictIntel[]>(RAJASTHAN_DISTRICTS);
  const [connections, setConnections] = useState<DistrictConnection[]>(DISTRICT_CONNECTIONS);
  const [selectedPost, setSelectedPost] = useState<InterceptPost | null>(INITIAL_INTERCEPTS[0]);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictIntel | null>(null);
  const [activeCategory, setActiveCategory] = useState<CrimeCategory | 'ALL'>('ALL');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(true);
  const [isMuted, setIsMuted] = useState(!sound.enabled);
  const [clock, setClock] = useState('');

  // Synchronize audio state with global sound system singleton
  useEffect(() => {
    return sound.subscribe((enabled) => {
      setIsMuted(!enabled);
    });
  }, []);

  // Clock in IST
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST');
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Background signal simulation
  useEffect(() => {
    if (!isSimulating) return;

    const simulatedTexts = [
      {
        text: '🔥 Fresh chitta stock arrived. WhatsApp 9876543210 @seller_raj. Malviya Nagar Jaipur drop.',
        channel: '@delhi_highs',
        districtId: 'jaipur',
        districtName: 'Jaipur'
      },
      {
        text: 'Urgent required ICICI current account + ATM card for USDT crypto rotation. 50k rent. raj.pay@oksbi',
        channel: '@mule_bazaar',
        districtId: 'jodhpur',
        districtName: 'Jodhpur'
      },
      {
        text: 'Brand new .32 bore revolver consignment. Delivery on Alwar highway bypass. Contact @rajasthan_arms_hub',
        channel: '@rajasthan_arms_hub',
        districtId: 'alwar',
        districtName: 'Alwar'
      },
      {
        text: 'Fake Aadhaar & Driving license with hologram sticker. Instant dispatch. 9876543210 @doc_forge_raj',
        channel: '@doc_forge_raj',
        districtId: 'kota',
        districtName: 'Kota'
      }
    ];

    const interval = setInterval(async () => {
      const randomItem = simulatedTexts[Math.floor(Math.random() * simulatedTexts.length)];
      const classification = classifyText(randomItem.text);
      const hash = await generateSHA256(randomItem.text);

      const newPost: InterceptPost = {
        id: `post_${Date.now().toString().slice(-4)}`,
        channel: randomItem.channel,
        channelSubscribers: `${(Math.random() * 8 + 4).toFixed(1)}K`,
        timestamp: new Date().toISOString(),
        capturedAt: new Date().toISOString(),
        rawText: randomItem.text,
        categories: classification.categories,
        confidence: classification.confidence,
        matchedSlang: classification.matchedTerms,
        entities: classification.extracted,
        districtId: randomItem.districtId,
        districtName: randomItem.districtName,
        sha256: hash,
        views: Math.floor(Math.random() * 1200) + 100,
        verified: false,
        sourceType: 'SYNTHETIC_DEMO',
        status: 'FLAGGED'
      };

      setPosts(prev => [newPost, ...prev.slice(0, 40)]);
      sound.playRadarPing();

      // Update district count
      setDistricts(prev =>
        prev.map(d =>
          d.id === randomItem.districtId
            ? { ...d, flaggedCount: d.flaggedCount + 1 }
            : d
        )
      );
    }, 12000);

    return () => clearInterval(interval);
  }, [isSimulating]);

  const handleIngestPosts = (newPosts: InterceptPost[]) => {
    setPosts(prev => [...newPosts, ...prev]);
    // Also update district counts
    newPosts.forEach(np => {
      setDistricts(prev =>
        prev.map(d =>
          d.id === np.districtId
            ? { ...d, flaggedCount: d.flaggedCount + 1 }
            : d
        )
      );
    });
    if (newPosts.length > 0) {
      setSelectedPost(newPosts[0]);
    }
  };

  const toggleSound = () => {
    sound.playMechanicalClick(true);
    sound.toggle();
  };

  return (
    <div className="h-screen w-screen bg-[#070A10] text-[#F1F5F9] flex flex-col overflow-hidden font-sans select-none">
      {/* TOP COMMAND BAR (Palantir Gotham / Linear 52px Glass Header) */}
      <header className="h-[52px] bg-[#070A10]/80 backdrop-blur-md border-b border-white/[0.07] px-4 flex items-center justify-between z-30 shrink-0">
        {/* Left: Branding & Return Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sound.playClick();
              onReturnToEditorial();
            }}
            className="flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[#94A3B8] hover:text-white px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors"
            title="Return to Product Showcase"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">EDITORIAL</span>
          </button>

          <div className="h-4 w-[1px] bg-white/[0.1] hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-white tracking-wide text-[13px]">PRAHARI</span>
              <span className="text-[10px] text-[#94A3B8] font-mono uppercase tracking-widest hidden md:inline">
                PRAHARI Concept Demonstration
              </span>
            </div>
          </div>
        </div>

        {/* Center: Live Telemetry Metrics (Clean Borderless Blocks) */}
        <div className="hidden lg:flex items-center gap-5 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[#94A3B8]">GRID:</span>
            <span className="text-emerald-400 font-mono font-medium">DEMO</span>
          </div>

          <div className="h-3.5 w-[1px] bg-white/[0.08]" />

          <div className="flex items-center gap-1.5">
            <span className="text-[#94A3B8]">CHANNELS:</span>
            <span className="text-cyan-400 font-mono font-semibold">DEMO</span>
          </div>

          <div className="h-3.5 w-[1px] bg-white/[0.08]" />

          <div className="flex items-center gap-1.5">
            <span className="text-[#94A3B8]">INTERCEPTS:</span>
            <span className="text-rose-400 font-mono font-semibold">{posts.length + 8940}</span>
          </div>

          <div className="h-3.5 w-[1px] bg-white/[0.08]" />

          <div className="flex items-center gap-1.5">
            <span className="text-[#94A3B8]">ENTITIES:</span>
            <span className="text-amber-400 font-mono font-semibold">3,114</span>
          </div>

          <div className="h-3.5 w-[1px] bg-white/[0.08]" />

          {/* Refined DEFCON Status Pill */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-400 text-[10px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            <span>DEFCON 2 // AMBER</span>
          </div>
        </div>

        {/* Right: Sound Toggle, Clock, Ingest Modal */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-[#94A3B8] font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>{clock}</span>
          </div>

          <button
            onClick={toggleSound}
            className="p-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[#94A3B8] hover:text-white rounded-md transition-colors"
            title="Toggle Sound Effects"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setIsUploadModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 px-3 py-1 rounded-md text-[11px] font-semibold transition-all shadow-[0_0_12px_rgba(34,211,238,0.25)]"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>IMPORT INTEL</span>
          </button>
        </div>
      </header>

      {/* MAIN 3-PANEL TACTICAL WORKSPACE */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden bg-[#070A10]">
        {/* LEFT PANEL: Live Intercept Feed & Filters (3.5 cols on lg) */}
        <div className="md:col-span-4 lg:col-span-3 h-full overflow-hidden border-r border-white/[0.07]">
          <LiveInterceptFeed
            posts={posts}
            selectedPost={selectedPost}
            onSelectPost={post => {
              setSelectedPost(post);
              // Also highlight corresponding district
              const dist = districts.find(d => d.id === post.districtId);
              if (dist) setSelectedDistrict(dist);
            }}
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            onOpenUploadModal={() => setIsUploadModalOpen(true)}
            isSimulating={isSimulating}
            onToggleSimulate={() => setIsSimulating(!isSimulating)}
          />
        </div>

        {/* CENTERPIECE: Interactive Rajasthan Vector Map (5 cols on lg) */}
        <div className="md:col-span-8 lg:col-span-5 h-full p-2 bg-[#070A10] overflow-hidden flex flex-col">
          <RajasthanMap
            districts={districts}
            connections={connections}
            selectedDistrict={selectedDistrict}
            onSelectDistrict={district => {
              setSelectedDistrict(district);
              // Pick first post in this district if available
              const distPost = posts.find(p => p.districtId === district.id);
              if (distPost) setSelectedPost(distPost);
            }}
            activeCategory={activeCategory}
          />
        </div>

        {/* RIGHT PANEL: Entity Graph & Forensic Dossier (4 cols on lg) */}
        <div className="hidden lg:block lg:col-span-4 h-full overflow-hidden border-l border-white/[0.07]">
          <InspectorPanel
            selectedPost={selectedPost}
            selectedDistrict={selectedDistrict}
            onCloseDistrict={() => setSelectedDistrict(null)}
            onSelectPostFromDistrict={post => setSelectedPost(post)}
            allPosts={posts}
          />
        </div>
      </div>

      {/* CSV/JSON Ingestion Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onIngestPosts={handleIngestPosts}
      />
    </div>
  );
};
