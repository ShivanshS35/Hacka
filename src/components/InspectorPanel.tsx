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
    <div className="h-full bg-[#0a0e16] border-l border-slate-800 flex flex-col font-mono text-xs select-none">
      {/* Tab Switcher Header */}
      <div className="bg-[#0e131d] border-b border-slate-800 p-2 flex items-center gap-1.5">
        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('GRAPH');
          }}
          className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'GRAPH'
              ? 'bg-cyan-950 border border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,229,255,0.25)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Network className="w-3.5 h-3.5" />
          <span>ENTITY GRAPH</span>
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('DOSSIER');
          }}
          className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'DOSSIER'
              ? 'bg-cyan-950 border border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,229,255,0.25)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>FORENSIC DOSSIER</span>
        </button>

        {selectedDistrict && (
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('DISTRICT');
            }}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'DISTRICT'
                ? 'bg-amber-950 border border-amber-400 text-amber-300'
                : 'text-amber-400 hover:bg-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{selectedDistrict.name.slice(0, 5)}</span>
          </button>
        )}
      </div>

      {/* Panel Body */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'GRAPH' && <EntityGraph />}

        {activeTab === 'DOSSIER' && <ForensicDossier post={selectedPost} />}

        {activeTab === 'DISTRICT' && selectedDistrict && (
          <div className="h-full flex flex-col p-4 bg-[#090d14] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <div className="text-white font-bold text-sm flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-cyan-400" />
                  <span>{selectedDistrict.name.toUpperCase()} DOSSIER</span>
                  <span className="text-slate-500 font-normal">({selectedDistrict.hindiName})</span>
                </div>
                <div className="text-[10px] text-cyan-400">RAJASTHAN POLICE JURISDICTION</div>
              </div>
              {onCloseDistrict && (
                <button
                  onClick={() => {
                    sound.playClick();
                    onCloseDistrict();
                    setActiveTab('GRAPH');
                  }}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-[#0f1520] p-3 rounded-lg border border-slate-800">
                <div className="text-slate-400 text-[10px]">THREAT LEVEL</div>
                <div className="text-red-400 font-bold text-base mt-0.5">{selectedDistrict.threatLevel}</div>
              </div>
              <div className="bg-[#0f1520] p-3 rounded-lg border border-slate-800">
                <div className="text-slate-400 text-[10px]">LOCAL INTERCEPTS</div>
                <div className="text-cyan-400 font-bold text-base mt-0.5">{selectedDistrict.flaggedCount} Cases</div>
              </div>
            </div>

            {/* Top Entities in District */}
            <div className="space-y-1.5">
              <div className="text-[10px] text-slate-400 font-bold">PRIMARY MONITORED IDENTIFIERS:</div>
              <div className="space-y-1">
                {selectedDistrict.topIdentifiers.map((id, i) => (
                  <div key={i} className="p-2 bg-[#0d121c] rounded border border-slate-800 flex justify-between items-center text-cyan-300">
                    <span>{id}</span>
                    <span className="text-[9px] text-slate-500">TAGGED</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Flagged District Intercepts */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="text-[10px] text-slate-400 font-bold">DISTRICT INTERCEPT POSTS:</div>
              {districtPosts.length === 0 ? (
                <div className="text-slate-500 italic p-3 text-center">No active intercepts in database.</div>
              ) : (
                districtPosts.map(p => (
                  <div
                    key={p.id}
                    onClick={() => {
                      sound.playClick();
                      if (onSelectPostFromDistrict) onSelectPostFromDistrict(p);
                      setActiveTab('DOSSIER');
                    }}
                    className="p-2.5 bg-[#0f1520] hover:bg-[#141d2c] border border-slate-800 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex justify-between items-center mb-1 text-[10px]">
                      <span className="text-cyan-400 font-bold">{p.channel}</span>
                      <span className="text-red-400 font-semibold">{p.confidence.toFixed(2)}</span>
                    </div>
                    <p className="text-slate-300 font-sans text-xs truncate">"{p.rawText}"</p>
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
