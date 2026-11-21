import React, { useState } from 'react';
import { Network, Lock, MapPin, X, AlertTriangle } from 'lucide-react';
import { EntityGraph } from './EntityGraph';
import { ForensicDossier } from './ForensicDossier';
import { InterceptPost, DistrictIntel, EntityNode } from '../types';
import { sound } from '../utils/audio';

interface InspectorPanelProps {
  selectedPost: InterceptPost | null;
  selectedDistrict: DistrictIntel | null;
  onCloseDistrict?: () => void;
  onSelectPostFromDistrict?: (post: InterceptPost) => void;
  allPosts: InterceptPost[];
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedPost,
  selectedDistrict,
  onCloseDistrict,
  onSelectPostFromDistrict,
  allPosts
}) => {
  const [activeTab, setActiveTab] = useState<'GRAPH' | 'DOSSIER' | 'DISTRICT'>('GRAPH');

  // If a district is clicked and activeTab is not DISTRICT, give priority to DISTRICT tab or notification
  const districtPosts = selectedDistrict
    ? allPosts.filter(p => p.districtId === selectedDistrict.id)
    : [];

  return (
    <div className="h-full bg-[#0C101A] flex flex-col font-sans select-none">
      {/* Tab Switcher Header */}
      <div className="bg-[#0C101A] border-b border-white/[0.07] px-3 py-2 flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('GRAPH');
          }}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'GRAPH'
              ? 'bg-white/[0.08] text-white shadow-sm'
              : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Network className="w-3.5 h-3.5 text-cyan-400" />
          <span>Entity Graph</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('DOSSIER');
          }}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'DOSSIER'
              ? 'bg-white/[0.08] text-white shadow-sm'
              : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Lock className="w-3.5 h-3.5 text-rose-400" />
          <span>Forensic Dossier</span>
        </button>

        {selectedDistrict && (
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('DISTRICT');
            }}
            className={`py-1.5 px-2.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'DISTRICT'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-amber-400 hover:bg-white/[0.04]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{selectedDistrict.name}</span>
          </button>
        )}
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'GRAPH' && <EntityGraph />}

        {activeTab === 'DOSSIER' && <ForensicDossier post={selectedPost} />}

        {activeTab === 'DISTRICT' && selectedDistrict && (
          <div className="h-full flex flex-col p-4 bg-[#0C101A] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.07]">
              <div>
                <div className="text-white font-semibold text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-cyan-400" />
                  <span>{selectedDistrict.name} District Dossier</span>
                  <span className="text-[#94A3B8] font-normal text-xs">({selectedDistrict.hindiName})</span>
                </div>
                <div className="text-[10px] text-[#94A3B8] font-mono uppercase tracking-wider mt-0.5">
                  Rajasthan Police Jurisdiction
                </div>
              </div>
              {onCloseDistrict && (
                <button
                  onClick={() => {
                    sound.playClick();
                    onCloseDistrict();
                    setActiveTab('GRAPH');
                  }}
                  className="p-1 rounded-md text-[#94A3B8] hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-2.5 text-[11px]">
              <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.06]">
                <div className="text-[#94A3B8] text-[10px] font-mono uppercase tracking-wider">THREAT LEVEL</div>
                <div className="text-rose-400 font-bold text-base mt-0.5">{selectedDistrict.threatLevel}</div>
              </div>
              <div className="bg-white/[0.02] p-3 rounded-xl border border-white/[0.06]">
                <div className="text-[#94A3B8] text-[10px] font-mono uppercase tracking-wider">LOCAL INTERCEPTS</div>
                <div className="text-cyan-400 font-mono font-semibold text-base mt-0.5">{selectedDistrict.flaggedCount} Cases</div>
              </div>
            </div>

            {/* Top Entities in District */}
            <div className="space-y-2">
              <div className="text-[11px] text-[#94A3B8] font-medium tracking-wide">PRIMARY MONITORED IDENTIFIERS</div>
              <div className="space-y-1.5">
                {selectedDistrict.topIdentifiers.map((id, i) => (
                  <div key={i} className="px-3 py-2 bg-white/[0.02] hover:bg-white/[0.04] rounded-lg border border-white/[0.06] flex justify-between items-center transition-colors">
                    <span className="font-mono text-xs text-cyan-300">{id}</span>
                    <span className="text-[10px] text-[#94A3B8] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08]">TAGGED</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Flagged District Intercepts */}
            <div className="space-y-2 pt-2 border-t border-white/[0.07]">
              <div className="text-[11px] text-[#94A3B8] font-medium tracking-wide">DISTRICT INTERCEPT POSTS</div>
              {districtPosts.length === 0 ? (
                <div className="text-[#94A3B8] italic p-4 text-center text-xs">No active intercepts in database.</div>
              ) : (
                districtPosts.map(p => (
                  <div
                    key={p.id}
                    onClick={() => {
                      sound.playClick();
                      if (onSelectPostFromDistrict) onSelectPostFromDistrict(p);
                      setActiveTab('DOSSIER');
                    }}
                    className="p-3 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] rounded-xl cursor-pointer transition-colors space-y-1.5"
                  >
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-cyan-400 font-mono font-medium">{p.channel}</span>
                      <span className="text-rose-400 font-mono font-semibold">{(p.confidence * 100).toFixed(0)}% Risk</span>
                    </div>
                    <p className="text-[#F1F5F9] text-xs line-clamp-2 leading-relaxed">"{p.rawText}"</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
