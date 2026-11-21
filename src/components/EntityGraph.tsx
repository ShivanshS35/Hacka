import React, { useState, useRef, useEffect } from 'react';
import { Network, ZoomIn, ZoomOut, RefreshCw, Shield, AlertTriangle } from 'lucide-react';
import { ENTITY_GRAPH_DATA } from '../data/mockData';
import { EntityNode } from '../types';
import { sound } from '../utils/audio';
import { NodeAvatarCharacter } from './NodeAvatarCharacter';

interface EntityGraphProps {
  onSelectEntity?: (entity: EntityNode) => void;
}

export const EntityGraph: React.FC<EntityGraphProps> = ({ onSelectEntity }) => {
  const [selectedNode, setSelectedNode] = useState<EntityNode | null>(
    ENTITY_GRAPH_DATA.nodes.find((n) => n.isHero) || null
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
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

  // Organic radial constellation layout around the central Hero node (raj.pay@oksbi)
  // Generous spacing across a 560 x 420 coordinate space
  const nodePositions: Record<string, { x: number; y: number }> = {
    // Center: Hero Node Nexus
    'raj.pay@oksbi': { x: 280, y: 210 },

    // Primary Connected Entities (Radius ~ 120-140)
    '9876543210': { x: 280, y: 80 }, // North (Phone broker)
    '@seller_raj': { x: 280, y: 340 }, // South (Telegram admin)
    'bc1qar...mdq': { x: 440, y: 210 }, // East (Crypto wallet)

    // Satellite Posts (Outer perimeter)
    post_001: { x: 120, y: 110 }, // North-West (Drugs ad via raj.pay)
    post_002: { x: 100, y: 210 }, // West (Mule account ad via raj.pay)
    post_003: { x: 120, y: 310 }, // South-West (Arms katta via 9876543210)
    post_004: { x: 440, y: 90 }, // North-East (Forged IDs via 9876543210 & @seller_raj)
    post_005: { x: 440, y: 330 }, // South-East (Border drugs via bc1qar & @seller_raj)
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const sensitivity = e.ctrlKey ? 0.015 : 0.002;
      const delta = -e.deltaY * sensitivity;

      setZoom((prevZoom) => {
        const nextZoom = prevZoom * (1 + delta);
        return Math.min(Math.max(nextZoom, 0.5), 3);
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

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
        // ignore
      }
      dragStartRef.current = null;
      setIsDragging(false);
    }
  };

  const getNodeColor = (node: EntityNode) => {
    if (node.isHero) return '#22D3EE';
    switch (node.type) {
      case 'upi':
        return '#22D3EE';
      case 'phone':
        return '#F59E0B';
      case 'telegram':
        return '#10B981';
      case 'crypto':
        return '#F43F5E';
      case 'post': {
        if (node.category === 'DRUGS') return '#F43F5E';
        if (node.category === 'FINANCIAL') return '#10B981';
        if (node.category === 'ARMS') return '#F59E0B';
        if (node.category === 'DOCUMENTS') return '#818CF8';
        return '#38BDF8';
      }
      default:
        return '#94A3B8';
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#070A10] select-none text-xs">
      {/* Sleek Toolbar Header */}
      <div className="p-3 bg-[#0C101A]/80 backdrop-blur-md border-b border-white/[0.07] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-cyan-400" />
          <span className="font-sans font-semibold text-xs text-slate-200">
            Entity Constellation
          </span>
          <span className="text-white/[0.1]">/</span>
          <span className="text-slate-400 font-mono text-[10px]">Cross-Channel Nexus</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              sound.playClick();
              setZoom((z) => Math.min(z + 0.2, 3));
            }}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/[0.05]"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setZoom((z) => Math.max(z - 0.2, 0.5));
            }}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/[0.05]"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/[0.05]"
            title="Reset Graph"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Constellation Canvas */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative flex-1 w-full overflow-hidden flex items-center justify-center ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {/* Softened background dot grid (opacity-10) */}
        <div className="absolute inset-0 dot-pattern opacity-10 pointer-events-none" />

        <svg
          viewBox="0 0 560 420"
          className="w-full h-full max-h-[460px] transition-transform duration-75 ease-out"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
          <defs>
            <filter id="glow-edge-subtle" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Radial glow for Hero constellation center */}
            <radialGradient id="hero-halo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Halo ring under Hero Node */}
          <circle cx={280} cy={210} r={55} fill="url(#hero-halo)" pointerEvents="none" />
          <circle
            cx={280}
            cy={210}
            r={70}
            fill="none"
            stroke="rgba(34, 211, 238, 0.12)"
            strokeWidth={1}
            strokeDasharray="4 6"
            pointerEvents="none"
          />

          <g className="graph-content">
            {/* Smooth Curved Cubic/Quadratic Bezier Connection Lines */}
            <g className="edges-layer">
              {ENTITY_GRAPH_DATA.edges.map((edge) => {
                const sPos = nodePositions[edge.source];
                const tPos = nodePositions[edge.target];
                if (!sPos || !tPos) return null;

                const isEdgeHighlighted =
                  selectedNode &&
                  (edge.source === selectedNode.id || edge.target === selectedNode.id);

                const strokeColor =
                  edge.category === 'DRUGS'
                    ? '#F43F5E'
                    : edge.category === 'ARMS'
                    ? '#F59E0B'
                    : edge.category === 'DOCUMENTS'
                    ? '#818CF8'
                    : edge.category === 'FINANCIAL'
                    ? '#10B981'
                    : '#22D3EE';

                // Smooth quadratic Bezier control point slightly bowed toward center
                const midX = (sPos.x + tPos.x) / 2;
                const midY = (sPos.y + tPos.y) / 2;
                const dx = tPos.x - sPos.x;
                const dy = tPos.y - sPos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                // Subtle deflection for curved path
                const curveFactor = 0.08;
                const cx = midX - dy * curveFactor;
                const cy = midY + dx * curveFactor;

                const pathData = `M ${sPos.x},${sPos.y} Q ${cx},${cy} ${tPos.x},${tPos.y}`;

                return (
                  <g key={edge.id}>
                    {/* Subtle outer glow when selected */}
                    {isEdgeHighlighted && (
                      <path
                        d={pathData}
                        fill="none"
                        stroke="#22D3EE"
                        strokeWidth={3}
                        strokeOpacity={0.3}
                        filter="url(#glow-edge-subtle)"
                      />
                    )}

                    {/* Core curved edge */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke={isEdgeHighlighted ? '#22D3EE' : strokeColor}
                      strokeWidth={isEdgeHighlighted ? 1.8 : 1.0}
                      strokeOpacity={isEdgeHighlighted ? 0.9 : 0.35}
                      strokeDasharray={isEdgeHighlighted ? '6 4' : undefined}
                      className={isEdgeHighlighted ? 'animate-pulse' : undefined}
                    />
                  </g>
                );
              })}
            </g>

            {/* Nodes Layer with Generous Constellation Spacing */}
            <g className="nodes-layer">
              {ENTITY_GRAPH_DATA.nodes.map((node) => {
                const pos = nodePositions[node.id];
                if (!pos) return null;

                const isSelected = selectedNode?.id === node.id;
                const isHovered = hoveredNodeId === node.id;
                const nodeColor = getNodeColor(node);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasMovedRef.current) return;
                      sound.playClick();
                      setSelectedNode(node);
                      if (onSelectEntity) onSelectEntity(node);
                    }}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                  >
                    <NodeAvatarCharacter
                      node={node}
                      isSelected={isSelected}
                      isHovered={isHovered}
                      pedestalColor={nodeColor}
                    />
                  </g>
                );
              })}
            </g>
          </g>
        </svg>
      </div>

      {/* Structured Glass Inspected Node Drawer (Palantir/Linear elevation) */}
      {selectedNode && (
        <div className="p-3.5 bg-[#0C101A] border-t border-white/[0.08] space-y-2.5 font-sans">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
              Inspected Entity
            </span>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-mono font-medium border"
              style={{
                backgroundColor: `${getNodeColor(selectedNode)}15`,
                color: getNodeColor(selectedNode),
                borderColor: `${getNodeColor(selectedNode)}30`,
              }}
            >
              {selectedNode.type.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white font-mono truncate">
              {selectedNode.label}
            </span>
            <span className="font-mono text-xs font-semibold text-rose-400 ml-2">
              {(selectedNode.riskScore * 100).toFixed(0)}% Risk
            </span>
          </div>

          {/* Clean Structured Risk Score Bar */}
          <div className="space-y-1">
            <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-rose-500 rounded-full transition-all duration-300"
                style={{ width: `${selectedNode.riskScore * 100}%` }}
              />
            </div>
          </div>

          {selectedNode.channels && (
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="text-slate-500">Cross-Channel Links:</span>
              <span className="font-mono text-cyan-300 text-[10px]">
                {selectedNode.channels.join(', ')}
              </span>
            </div>
          )}

          {selectedNode.isHero && (
            <div className="p-2.5 bg-rose-500/[0.08] border border-rose-500/20 rounded-lg text-[11px] text-slate-300 flex items-start gap-2">
              <span className="text-rose-400 font-bold">●</span>
              <span className="leading-snug">
                <strong className="text-rose-300">Central Nexus:</strong> Simultaneously linked
                across narcotics operations (@delhi_highs) and mule account rings (@mule_bazaar).
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
