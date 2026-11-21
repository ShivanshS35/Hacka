import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Search,
  Filter,
  ShieldAlert,
  MapPin,
  ExternalLink,
  ChevronRight,
  X,
  Lock,
  Layers,
  Sparkles,
  ArrowRight,
  Hash,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { ENTITY_GRAPH_DATA } from '../data/mockData';
import { EntityNode, InterceptPost } from '../types';
import { sound } from '../utils/audio';
import { NodeAvatarCharacter } from './NodeAvatarCharacter';

interface EntityTopologyPageProps {
  onLocateDistrict?: (districtId: string) => void;
  onOpenDossier?: (postId: string) => void;
  onReturnToCommand?: () => void;
}

type NodeFilterType = 'ALL' | 'HERO' | 'SELLER' | 'CRYPTO' | 'POSTS';

export const EntityTopologyPage: React.FC<EntityTopologyPageProps> = ({
  onLocateDistrict,
  onOpenDossier,
  onReturnToCommand,
}) => {
  const [selectedNode, setSelectedNode] = useState<EntityNode | null>(
    ENTITY_GRAPH_DATA.nodes.find((n) => n.isHero) || ENTITY_GRAPH_DATA.nodes[0]
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<NodeFilterType>('ALL');

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const hasMovedRef = useRef<boolean>(false);

  // Expansive 1400 x 900 coordinate space for generous breathing room
  const nodePositions: Record<string, { x: number; y: number; districtNexus: string }> = {
    // Center: Hero Node Nexus
    'raj.pay@oksbi': { x: 700, y: 450, districtNexus: 'jaipur' },

    // Primary Connected Entities (Radius ~ 240)
    '9876543210': { x: 700, y: 210, districtNexus: 'bikaner' }, // North: Arms/Phone
    '@seller_raj': { x: 700, y: 690, districtNexus: 'sikar' }, // South: Dark Seller
    'bc1qar...mdq': { x: 1040, y: 450, districtNexus: 'ganganagar' }, // East: Crypto Escrow

    // Satellite Posts (Outer perimeter)
    post_001: { x: 380, y: 220, districtNexus: 'jaipur' }, // NW: Narcotics
    post_002: { x: 320, y: 450, districtNexus: 'jodhpur' }, // W: Mule Accounts
    post_003: { x: 380, y: 680, districtNexus: 'alwar' }, // SW: Arms Hub
    post_004: { x: 1040, y: 210, districtNexus: 'kota' }, // NE: Doc Forge
    post_005: { x: 1040, y: 690, districtNexus: 'ganganagar' }, // SE: Border Drop
  };

  // Trackpad pinch-to-zoom and two-finger scroll zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const sensitivity = e.ctrlKey ? 0.015 : 0.002;
      const delta = -e.deltaY * sensitivity;

      setZoom((prevZoom) => {
        const nextZoom = prevZoom * (1 + delta);
        return Math.min(Math.max(nextZoom, 0.4), 2.8);
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Pan controls
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    hasMovedRef.current = false;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMovedRef.current = true;
    }
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
    dragStartRef.current = null;
    setIsDragging(false);
  };

  const resetView = () => {
    sound.playClick();
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Filter and search logic
  const filteredNodes = useMemo(() => {
    return ENTITY_GRAPH_DATA.nodes.filter((node) => {
      // Category filter
      if (activeFilter === 'HERO' && !node.isHero && node.type !== 'upi') return false;
      if (activeFilter === 'SELLER' && node.type !== 'telegram') return false;
      if (activeFilter === 'CRYPTO' && node.type !== 'crypto') return false;
      if (activeFilter === 'POSTS' && node.type !== 'post') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = node.id.toLowerCase().includes(q);
        const matchesLabel = node.label.toLowerCase().includes(q);
        const matchesType = node.type.toLowerCase().includes(q);
        const matchesChannels = node.channels?.some((c) => c.toLowerCase().includes(q));
        return matchesId || matchesLabel || matchesType || matchesChannels;
      }
      return true;
    });
  }, [activeFilter, searchQuery]);

  // Edges filtered
  const visibleEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    return ENTITY_GRAPH_DATA.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  }, [filteredNodes]);

  // Get color for edge/connection
  const getEdgeStroke = (edge: (typeof ENTITY_GRAPH_DATA.edges)[0]) => {
    if (edge.category === 'DRUGS') return '#22D3EE'; // Cyan
    if (edge.category === 'ARMS') return '#F59E0B'; // Amber
    if (edge.category === 'DOCUMENTS') return '#C084FC'; // Purple
    if (edge.category === 'FINANCIAL') return '#34D399'; // Emerald
    return '#94A3B8';
  };

  // Node details for drawer
  const selectedNodeInfo = useMemo(() => {
    if (!selectedNode) return null;
    const nexusDistrictId = nodePositions[selectedNode.id]?.districtNexus || 'jaipur';
    const connectedEdges = ENTITY_GRAPH_DATA.edges.filter(
      (e) => e.source === selectedNode.id || e.target === selectedNode.id
    );

    return {
      node: selectedNode,
      districtId: nexusDistrictId,
      connectionsCount: connectedEdges.length,
      connectedEdges,
    };
  }, [selectedNode]);

  return (
    <div className="relative w-full h-full bg-[#070A10] overflow-hidden select-none font-sans">
      {/* 1. EXPANSIVE CANVAS WITH DRAG & PINCH-TO-ZOOM */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`w-full h-full touch-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        } relative flex items-center justify-center`}
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.05) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      >
        {/* Ambient Radial Glow centered around raj.pay@oksbi */}
        <div
          className="absolute w-[800px] h-[800px] rounded-full pointer-events-none opacity-25"
          style={{
            background:
              'radial-gradient(circle, rgba(34, 211, 238, 0.18) 0%, rgba(12, 16, 26, 0.05) 65%, transparent 100%)',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        />

        {/* 3D GRAPH SVG CANVAS */}
        <svg
          viewBox="0 0 1400 900"
          className="w-full h-full pointer-events-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          <defs>
            {/* Hologram Pulse Animation for Central Hero Node */}
            <radialGradient id="topo_hero_pedestal" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.45" />
              <stop offset="70%" stopColor="#0891B2" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#070A10" stopOpacity="0" />
            </radialGradient>

            {/* Glowing drop shadow filter */}
            <filter id="topo_glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Central Hero Radial Aura Rings */}
          <g transform="translate(700, 450)">
            <circle
              r="140"
              fill="url(#topo_hero_pedestal)"
              className="animate-pulse"
              style={{ animationDuration: '4s' }}
            />
            <circle
              r="220"
              fill="none"
              stroke="rgba(34, 211, 238, 0.12)"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
            <circle
              r="340"
              fill="none"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="1"
              strokeDasharray="6 8"
            />
          </g>

          {/* CURVED BEZIER CONNECTION ARCS */}
          <g className="edges-layer">
            {visibleEdges.map((edge) => {
              const srcPos = nodePositions[edge.source];
              const tgtPos = nodePositions[edge.target];
              if (!srcPos || !tgtPos) return null;

              // Generate smooth quadratic Bezier curve
              const midX = (srcPos.x + tgtPos.x) / 2;
              const midY = (srcPos.y + tgtPos.y) / 2;
              // Add slight perpendicular curve offset
              const dx = tgtPos.x - srcPos.x;
              const dy = tgtPos.y - srcPos.y;
              const offset = 36;
              const controlX = midX - dy * (offset / 400);
              const controlY = midY + dx * (offset / 400);

              const isHighlighted =
                selectedNode &&
                (selectedNode.id === edge.source || selectedNode.id === edge.target);
              const isHovered =
                hoveredNodeId &&
                (hoveredNodeId === edge.source || hoveredNodeId === edge.target);

              const strokeColor = getEdgeStroke(edge);

              return (
                <g key={edge.id} className="pointer-events-none">
                  {/* Background halo curve */}
                  <path
                    d={`M ${srcPos.x} ${srcPos.y - 10} Q ${controlX} ${controlY} ${tgtPos.x} ${
                      tgtPos.y - 10
                    }`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isHighlighted ? 4 : isHovered ? 3 : 1.5}
                    strokeOpacity={isHighlighted ? 0.85 : isHovered ? 0.6 : 0.25}
                    filter={isHighlighted || isHovered ? 'url(#topo_glow)' : undefined}
                  />

                  {/* Flowing particle animation pulse */}
                  <path
                    d={`M ${srcPos.x} ${srcPos.y - 10} Q ${controlX} ${controlY} ${tgtPos.x} ${
                      tgtPos.y - 10
                    }`}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={isHighlighted ? 2.5 : 1.5}
                    strokeDasharray="8 40"
                    strokeDashoffset="0"
                    strokeOpacity={isHighlighted ? 0.9 : 0.45}
                    className="animate-flow"
                    style={{ animationDuration: isHighlighted ? '1.5s' : '3.5s' }}
                  />

                  {/* Midpoint Label */}
                  {edge.label && (
                    <g transform={`translate(${controlX}, ${controlY})`}>
                      <rect
                        x="-44"
                        y="-8"
                        width="88"
                        height="16"
                        rx="4"
                        fill="#070A10"
                        stroke={strokeColor}
                        strokeWidth="0.8"
                        strokeOpacity="0.4"
                      />
                      <text
                        textAnchor="middle"
                        y="3"
                        className="font-mono text-[8px] tracking-wider fill-slate-300 font-medium"
                      >
                        {edge.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* 3D FIGURINE NODES */}
          <g className="nodes-layer">
            {filteredNodes.map((node) => {
              const pos = nodePositions[node.id];
              if (!pos) return null;

              const isSelected = selectedNode?.id === node.id;
              const isHovered = hoveredNodeId === node.id;
              const isHero = Boolean(node.isHero || node.id === 'raj.pay@oksbi');

              // Pedestal neon color
              const pedestalColor = isHero
                ? '#22D3EE'
                : node.type === 'crypto'
                ? '#F43F5E'
                : node.type === 'phone'
                ? '#F59E0B'
                : node.type === 'telegram'
                ? '#A855F7'
                : '#38BDF8';

              // Large, high-detail scale for the dedicated topology view
              const nodeScale = isHero ? (isSelected ? 1.9 : 1.75) : isSelected ? 1.5 : 1.35;

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y}) scale(${nodeScale})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!hasMovedRef.current) {
                      sound.playClick();
                      setSelectedNode(node);
                    }
                  }}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  className="cursor-pointer pointer-events-auto transition-transform duration-200"
                >
                  {/* Node Avatar 3D Character Figurine */}
                  <NodeAvatarCharacter
                    node={node}
                    isSelected={isSelected}
                    isHovered={isHovered}
                    pedestalColor={pedestalColor}
                  />

                  {/* Floating Identifier Monospace Label */}
                  <g transform="translate(0, 24)">
                    <rect
                      x="-55"
                      y="0"
                      width="110"
                      height="20"
                      rx="6"
                      fill="#0C101A"
                      stroke={isSelected ? '#22D3EE' : 'rgba(255, 255, 255, 0.12)'}
                      strokeWidth={isSelected ? 1.5 : 1}
                      className="shadow-xl"
                    />
                    <text
                      textAnchor="middle"
                      y="13"
                      className={`font-mono text-[9px] font-semibold tracking-wide ${
                        isSelected
                          ? 'fill-cyan-300'
                          : isHero
                          ? 'fill-white'
                          : 'fill-slate-300'
                      }`}
                    >
                      {node.label.length > 15 ? node.label.slice(0, 14) + '…' : node.label}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* 2. FLOATING TOP-LEFT FILTER & SEARCH BAR */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2.5 max-w-md w-full pointer-events-none">
        {/* Search Input Card */}
        <div className="pointer-events-auto bg-[#0C101A]/90 backdrop-blur-xl border border-white/[0.08] rounded-xl p-2.5 shadow-2xl flex items-center gap-2">
          <Search className="w-4 h-4 text-cyan-400 shrink-0 ml-1" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search UPI, telegram, crypto wallet, phone, or post..."
            className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Filter Pills Bar */}
        <div className="pointer-events-auto bg-[#0C101A]/85 backdrop-blur-xl border border-white/[0.08] rounded-xl p-1.5 shadow-xl flex items-center gap-1 overflow-x-auto text-[11px] font-sans">
          {(
            [
              { key: 'ALL', label: 'All Nodes' },
              { key: 'HERO', label: 'Hero / UPI' },
              { key: 'SELLER', label: 'Sellers' },
              { key: 'CRYPTO', label: 'Crypto' },
              { key: 'POSTS', label: 'Flagged Posts' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => {
                sound.playClick();
                setActiveFilter(item.key);
              }}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeFilter === item.key
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Match Count Badge */}
        <div className="pointer-events-auto inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-[10px] font-mono text-slate-400 self-start">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>
            {filteredNodes.length} of {ENTITY_GRAPH_DATA.nodes.length} Network Entities Active
          </span>
        </div>
      </div>

      {/* 3. FLOATING GLASS ENTITY INSPECTOR DRAWER (RIGHT SIDE) */}
      <AnimatePresence>
        {selectedNodeInfo && (
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute top-4 right-4 bottom-4 z-20 w-[360px] bg-[#0C101A]/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col overflow-hidden font-sans select-none"
          >
            {/* Drawer Header */}
            <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="text-white font-semibold text-xs tracking-tight">
                  Entity Intelligence Dossier
                </span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Large Figurine Avatar Spotlight Preview */}
              <div className="relative h-44 bg-[#070A10] rounded-xl border border-white/[0.06] flex items-center justify-center overflow-hidden">
                <div
                  className="absolute inset-0 opacity-40 pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(circle at center, rgba(34, 211, 238, 0.25) 0%, transparent 70%)',
                  }}
                />

                <svg viewBox="0 0 120 120" className="w-36 h-36 relative z-10">
                  <g transform="translate(60, 68) scale(1.6)">
                    <NodeAvatarCharacter
                      node={selectedNodeInfo.node}
                      isSelected={true}
                      isHovered={false}
                      pedestalColor={
                        selectedNodeInfo.node.isHero
                          ? '#22D3EE'
                          : selectedNodeInfo.node.type === 'crypto'
                          ? '#F43F5E'
                          : '#F59E0B'
                      }
                    />
                  </g>
                </svg>

                {/* Role Pill Overlay */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between px-2.5 py-1 rounded-lg bg-[#0C101A]/80 backdrop-blur border border-white/[0.08] text-[10px] font-mono">
                  <span className="text-slate-400 uppercase">
                    TYPE: {selectedNodeInfo.node.type}
                  </span>
                  <span className="text-cyan-400 font-semibold">
                    {selectedNodeInfo.node.isHero ? 'HERO NEXUS' : 'SYNDICATE NODE'}
                  </span>
                </div>
              </div>

              {/* Identifier & Category Info */}
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  PRIMARY IDENTIFIER
                </div>
                <div className="font-mono text-sm text-cyan-300 font-bold break-all bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.06]">
                  {selectedNodeInfo.node.label}
                </div>
              </div>

              {/* Structured Risk Score Meter */}
              <div className="bg-white/[0.02] p-3.5 rounded-xl border border-white/[0.06] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Syndicate Risk Rating</span>
                  <span className="font-mono font-bold text-rose-400">
                    {Math.round((selectedNodeInfo.node.riskScore || 0.95) * 100)}% CRITICAL
                  </span>
                </div>

                <div className="h-1.5 w-full bg-white/[0.08] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.round((selectedNodeInfo.node.riskScore || 0.95) * 100)}%`,
                    }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-amber-400 to-rose-500 rounded-full"
                  />
                </div>

                <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-1">
                  <span>Confidence: 0.98</span>
                  <span>Cross-Channel Flags: {selectedNodeInfo.connectionsCount}</span>
                </div>
              </div>

              {/* Linked Telegram Channels */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium text-slate-400">
                  MONITORED TELEGRAM CHANNELS
                </div>
                <div className="space-y-1">
                  {(selectedNodeInfo.node.channels || ['@delhi_highs', '@mule_bazaar']).map(
                    (chan, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.05] text-xs font-mono text-cyan-400"
                      >
                        <span>{chan}</span>
                        <span className="text-[10px] text-slate-500">ACTIVE FEED</span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Cross-Channel Correlation Summary */}
              <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.06] space-y-1.5 text-xs">
                <div className="text-slate-400 font-medium">Syndicate Nexus Analysis</div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  {selectedNodeInfo.node.isHero
                    ? 'Central UPI escrow nexus used for receiving narcotics revenue across Delhi-Jaipur channels and routing payments to mule accounts in Jodhpur.'
                    : selectedNodeInfo.node.type === 'phone'
                    ? 'Primary communication broker coordinating arms katte shipments and counterfeit document deliveries across Shekhawati and Bikaner.'
                    : selectedNodeInfo.node.type === 'crypto'
                    ? 'Cold escrow wallet utilized for settling cross-border synthetic opioid consignments in Sri Ganganagar.'
                    : 'Flagged illicit trade entity operating under Telegram channel syndicates.'}
                </p>
              </div>
            </div>

            {/* Action Buttons at Footer */}
            <div className="p-4 border-t border-white/[0.07] bg-[#0C101A] space-y-2 shrink-0">
              {/* 1. Locate on Rajasthan Map */}
              <button
                onClick={() => {
                  sound.playSuccessChime();
                  if (onLocateDistrict) {
                    onLocateDistrict(selectedNodeInfo.districtId);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold py-2.5 rounded-xl text-xs transition-colors shadow-[0_0_15px_rgba(34,211,238,0.25)]"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>
                  Locate on Rajasthan Map ({selectedNodeInfo.districtId.toUpperCase()})
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {/* 2. Return to Command Center */}
              {onReturnToCommand && (
                <button
                  onClick={() => {
                    sound.playClick();
                    onReturnToCommand();
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 py-2 rounded-xl text-xs transition-colors"
                >
                  <span>Return to Command Center Overview</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. FLOATING BOTTOM-RIGHT ZOOM & PAN CONTROLS */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 bg-[#0C101A]/90 backdrop-blur-xl border border-white/[0.08] p-1.5 rounded-xl shadow-2xl">
        <button
          onClick={() => {
            sound.playClick();
            setZoom((z) => Math.min(z + 0.2, 2.8));
          }}
          className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setZoom((z) => Math.max(z - 0.2, 0.4));
          }}
          className="p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-white/[0.08]" />

        <button
          onClick={resetView}
          className="px-2.5 py-1 text-slate-300 hover:text-white hover:bg-white/[0.06] rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-colors"
          title="Reset Zoom & Pan"
        >
          <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
          <span>{Math.round(zoom * 100)}%</span>
        </button>
      </div>
    </div>
  );
};
