import React, { useState, useRef, useEffect } from 'react';
import { Network, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
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

  // Position nodes spatially for a clean, futuristic cyber-command layout with zero overlaps
  const nodePositions: Record<string, { x: number; y: number }> = {
    // Left column: Intercepted Posts
    post_001: { x: 80, y: 65 },
    post_002: { x: 80, y: 195 },
    post_003: { x: 80, y: 325 },
    // Center column: Key Identified Syndicate Entities
    '9876543210': { x: 270, y: 65 },
    'raj.pay@oksbi': { x: 270, y: 195 }, // Hero Center Nexus
    '@seller_raj': { x: 270, y: 325 },
    // Right column: Posts & Shadow Crypto Wallet
    post_004: { x: 460, y: 65 },
    'bc1qar...mdq': { x: 460, y: 195 },
    post_005: { x: 460, y: 325 },
  };

  // Non-passive wheel event listener to handle MacBook trackpad pinch and two-finger scroll zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Trackpad pinch sets e.ctrlKey = true; normal scroll zoom uses smaller delta
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

  // Pointer drag panning handlers
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
        // ignore if not captured
      }
      dragStartRef.current = null;
      setIsDragging(false);
    }
  };

  const getNodeColor = (node: EntityNode) => {
    if (node.isHero) return '#00E5FF';
    switch (node.type) {
      case 'upi':
        return '#00E5FF';
      case 'phone':
        return '#F59E0B';
      case 'telegram':
        return '#10B981';
      case 'crypto':
        return '#FF3B30';
      case 'post': {
        if (node.category === 'DRUGS') return '#FF3B30';
        if (node.category === 'FINANCIAL') return '#10B981';
        if (node.category === 'ARMS') return '#F59E0B';
        if (node.category === 'DOCUMENTS') return '#8B5CF6';
        return '#38BDF8';
      }
      default:
        return '#94A3B8';
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#070a0f] select-none text-xs font-mono">
      {/* Graph Toolbar */}
      <div className="p-3 bg-[#0d131d] border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-cyan-400" />
          <span className="text-white font-bold">CROSS-CHANNEL TOPOLOGY</span>
          <span className="text-slate-500 hidden sm:inline">|</span>
          <span className="text-cyan-400 hidden sm:inline text-[10px]">3D FIGURINE GIS NEXUS</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">ZOOM:</span>
          <button
            onClick={() => {
              sound.playClick();
              setZoom((z) => Math.min(z + 0.2, 3));
            }}
            className="p-1 text-slate-400 hover:text-cyan-400 bg-slate-900 rounded"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setZoom((z) => Math.max(z - 0.2, 0.5));
            }}
            className="p-1 text-slate-400 hover:text-cyan-400 bg-slate-900 rounded"
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
            className="p-1 text-slate-400 hover:text-cyan-400 bg-slate-900 rounded"
            title="Reset Zoom & Pan"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Canvas Container with Gesture Panning & Pinch Zoom */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative flex-1 p-2 overflow-hidden flex items-center justify-center touch-none select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {/* Futuristic Background Grid */}
        <div className="absolute inset-0 dot-pattern opacity-15 pointer-events-none" />

        <svg
          viewBox="10 10 520 375"
          className="w-full h-full max-h-[380px] overflow-visible pointer-events-none"
        >
          <defs>
            <filter id="glow-hero" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-edge" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Interactive Topology Graph Group with Pan & Zoom Transform */}
          <g
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '270px 195px',
              transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            }}
            className="pointer-events-auto"
          >
            {/* Layer 1: Render Edges (Underneath Pedestals) */}
            <g className="edges-layer">
              {ENTITY_GRAPH_DATA.edges.map((edge) => {
                const sPos = nodePositions[edge.source];
                const tPos = nodePositions[edge.target];
                if (!sPos || !tPos) return null;

                const isEdgeHighlighted =
                  Boolean(
                    selectedNode &&
                      (edge.source === selectedNode.id || edge.target === selectedNode.id)
                  ) ||
                  Boolean(
                    hoveredNodeId &&
                      (edge.source === hoveredNodeId || edge.target === hoveredNodeId)
                  );

                const strokeColor =
                  edge.category === 'DRUGS'
                    ? '#FF3B30'
                    : edge.category === 'ARMS'
                    ? '#F59E0B'
                    : edge.category === 'DOCUMENTS'
                    ? '#8B5CF6'
                    : edge.category === 'FINANCIAL'
                    ? '#10B981'
                    : '#00E5FF';

                return (
                  <g key={edge.id}>
                    {/* Outer Glow Line when highlighted */}
                    {isEdgeHighlighted && (
                      <line
                        x1={sPos.x}
                        y1={sPos.y}
                        x2={tPos.x}
                        y2={tPos.y}
                        stroke="#00E5FF"
                        strokeWidth={4.5}
                        strokeOpacity={0.4}
                        filter="url(#glow-edge)"
                      />
                    )}

                    {/* Core Edge Line */}
                    <line
                      x1={sPos.x}
                      y1={sPos.y}
                      x2={tPos.x}
                      y2={tPos.y}
                      stroke={isEdgeHighlighted ? '#00E5FF' : strokeColor}
                      strokeWidth={isEdgeHighlighted ? 2.5 : 1.3}
                      strokeOpacity={isEdgeHighlighted ? 1 : 0.45}
                      strokeDasharray={edge.category === 'DRUGS' ? '4,3' : undefined}
                      className={isEdgeHighlighted ? 'animate-pulse' : undefined}
                    />
                  </g>
                );
              })}
            </g>

            {/* Layer 2: Render 3D Figurines on Holographic Pedestals */}
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
                      // If the user was dragging/panning the canvas, ignore the node click
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

      {/* Selected Node Telemetry Dossier */}
      {selectedNode && (
        <div className="p-3 bg-[#0d131d] border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px]">INSPECTED NODE:</span>
            <span
              className="px-2 py-0.5 rounded text-[9px] font-bold border"
              style={{
                backgroundColor: `${getNodeColor(selectedNode)}20`,
                color: getNodeColor(selectedNode),
                borderColor: `${getNodeColor(selectedNode)}60`,
              }}
            >
              {selectedNode.type.toUpperCase()}
            </span>
          </div>

          <div className="text-sm font-bold text-white flex items-center justify-between">
            <span className="truncate">{selectedNode.label}</span>
            <span className="text-red-400 font-mono text-xs ml-2">
              RISK: {(selectedNode.riskScore * 100).toFixed(0)}%
            </span>
          </div>

          {selectedNode.channels && (
            <div className="text-[10px] text-slate-400">
              <span className="text-slate-500">Cross-Channel Links: </span>
              <span className="text-cyan-300">{selectedNode.channels.join(', ')}</span>
            </div>
          )}

          {selectedNode.isHero && (
            <div className="p-2 bg-red-950/40 border border-red-500/40 rounded text-[10px] text-red-300">
              ⚠️ <strong>Hero Link Nexus:</strong> This UPI is simultaneously active in Delhi Highs
              (Narcotics) and Mule Bazaar (Financial Fraud).
            </div>
          )}
        </div>
      )}
    </div>
  );
};
