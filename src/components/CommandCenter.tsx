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
        verified: true,
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
    sound.enabled = !sound.enabled;
    setIsMuted(!sound.enabled);
    sound.playClick();
  };

  return (
    <div className="h-screen w-screen bg-[#080B10] text-slate-100 flex flex-col overflow-hidden font-sans select-none">
      {/* TOP TACTICAL TELEMETRY HEADER */}
      <header className="bg-[#0b1019] border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between font-mono text-xs z-30 shrink-0">
        {/* Left: Branding & Return Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              sound.playClick();
              onReturnToEditorial();
            }}
            className="flex items-center gap-1.5 bg-[#121924] hover:bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
            title="Return to Product Showcase"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">EDITORIAL</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-cyan-950 border border-cyan-400 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div>
              <span className="font-bold text-white tracking-wider">PRAHARI // COMMAND CENTER</span>
              <span className="text-[10px] text-cyan-400 font-normal ml-2 hidden md:inline">
                RAJASTHAN POLICE CYBER CELL
              </span>
            </div>
          </div>
        </div>

        {/* Center: Live Telemetry Metrics */}
        <div className="hidden lg:flex items-center gap-6 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-slate-400">STATUS:</span>
            <span className="text-emerald-400 font-bold">ONLINE // 14ms</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">CHANNELS:</span>
            <span className="text-cyan-400 font-bold">1,428 ACTIVE</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">INTERCEPTS:</span>
            <span className="text-red-400 font-bold">{posts.length + 8940}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">ENTITIES LINKED:</span>
            <span className="text-yellow-400 font-bold">3,114</span>
          </div>

          <div className="bg-red-950/80 text-red-400 border border-red-800/80 px-2 py-0.5 rounded text-[10px] font-bold">
            DEFCON 2 // AMBER
          </div>
        </div>

        {/* Right: Sound Toggle, Clock, Ingest Modal */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>{clock}</span>
          </div>

          <button
            onClick={toggleSound}
            className="p-1.5 bg-[#121924] hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg transition-colors"
            title="Toggle Sound Effects"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setIsUploadModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-cyan-400 text-black px-3 py-1 rounded-lg text-[11px] font-bold hover:brightness-110 transition-all shadow-[0_0_15px_rgba(0,229,255,0.3)]"
          >
            <Upload className="w-3.5 h-3.5 fill-black" />
            <span>IMPORT</span>
          </button>
        </div>
      </header>

      {/* MAIN 3-PANEL TACTICAL WORKSPACE */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
        {/* LEFT PANEL: Live Intercept Feed & Filters (3.5 cols on lg) */}
        <div className="md:col-span-4 lg:col-span-3 h-full overflow-hidden">
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
        <div className="md:col-span-8 lg:col-span-5 h-full p-2 bg-[#06090e] overflow-hidden flex flex-col">
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
        <div className="hidden lg:block lg:col-span-4 h-full overflow-hidden">
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
