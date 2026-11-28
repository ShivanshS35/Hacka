import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Network, ZoomIn, ZoomOut, RefreshCw, Shield, AlertTriangle } from 'lucide-react';
import { ENTITY_GRAPH_DATA } from '../data/mockData';
import { EntityNode, EntityEdge } from '../types';
import { prahariApi } from '../services/api';
import { selectAndLayout } from '../utils/graphLayout';
import { sound } from '../utils/audio';
import { NodeAvatarCharacter } from './NodeAvatarCharacter';

interface EntityGraphProps {
  onSelectEntity?: (entity: EntityNode) => void;
}

export const EntityGraph: React.FC<EntityGraphProps> = ({ onSelectEntity }) => {
  // Live graph from the backend; the bundled sample is shown only while the backend is unreachable.
  const [graph, setGraph] = useState<{ nodes: EntityNode[]; edges: EntityEdge[] }>({ nodes: [], edges: [] });
  const [source, setSource] = useState<'LOADING' | 'LIVE' | 'SAMPLE'>('LOADING');
  const [selectedNode, setSelectedNode] = useState<EntityNode | null>(null);

  const loadGraph = useCallback(async () => {
    const live = await prahariApi.getGraph();
    if (live && live.nodes.length > 0) {
      setGraph(live);
      setSource('LIVE');
    } else {
      // Backend unreachable or empty: show the bundled sample (clearly labelled) unless live data was already loaded.
      setSource((s) => {
        if (s === 'LIVE') return s;
        setGraph(ENTITY_GRAPH_DATA);
        return 'SAMPLE';
      });
    }
  }, []);

  useEffect(() => {
    loadGraph();
    const timer = window.setInterval(loadGraph, 10000);
    let debounce: number | undefined;
    const unsubscribe = prahariApi.subscribeToStream(() => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(loadGraph, 600);
    });
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(debounce);
      unsubscribe();
    };
  }, [loadGraph]);

  const layout = useMemo(() => selectAndLayout(graph.nodes, graph.edges), [graph]);
  const heroNode = layout.nodes.find((n) => n.isHero) ?? null;
  const heroPos = heroNode ? layout.positions[heroNode.id] : null;

  // Select the most-linked identifier once data arrives, unless the analyst already picked something.
  useEffect(() => {
    // Re-resolve by id so the drawer never keeps showing an older copy of the node (e.g. from the sample graph).
    setSelectedNode((cur) => layout.nodes.find((n) => n.id === cur?.id) ?? heroNode);
  }, [layout, heroNode]);
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
          <span className="text-slate-400 font-mono text-[10px]">Cross-Channel Links</span>
          <span
            className={`ml-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold border ${
              source === 'LIVE'
                ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                : 'text-amber-300 border-amber-500/30 bg-amber-500/10'
            }`}
            title={
              source === 'LIVE'
                ? 'Built from the records currently stored on the backend'
                : source === 'LOADING'
                ? 'Contacting the backend...'
                : 'Backend unreachable, so this is the bundled sample graph'
            }
          >
            {source === 'LIVE' ? 'LIVE' : source === 'LOADING' ? 'LOADING' : 'SAMPLE'}
          </span>
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
          {heroPos && (
            <>
              <circle cx={heroPos.x} cy={heroPos.y} r={55} fill="url(#hero-halo)" pointerEvents="none" />
              <circle
                cx={heroPos.x}
                cy={heroPos.y}
                r={70}
                fill="none"
                stroke="rgba(34, 211, 238, 0.12)"
                strokeWidth={1}
                strokeDasharray="4 6"
                pointerEvents="none"
              />
            </>
          )}

          <g className="graph-content">
            {/* Smooth Curved Cubic/Quadratic Bezier Connection Lines */}
            <g className="edges-layer">
              {layout.edges.map((edge) => {
                const sPos = layout.positions[edge.source];
                const tPos = layout.positions[edge.target];
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
              {layout.nodes.map((node) => {
                const pos = layout.positions[node.id];
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
        {source !== 'LOADING' && layout.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-slate-500 font-mono">
            No linked records yet. Import or scan some posts.
          </div>
        )}
        <div className="absolute bottom-1.5 left-2 text-[9px] font-mono text-slate-500 pointer-events-none">
          showing {layout.nodes.length} of {layout.totalNodes} nodes
        </div>
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
            <span className="font-mono text-xs font-semibold text-cyan-300 ml-2">
              {selectedNode.channels?.length || 0} linked channels
            </span>
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
                <strong className="text-rose-300">{source === 'LIVE' ? 'Seen in 2+ channels:' : 'Sample link:'}</strong>{' '}
                This identifier appears in more than one channel{source === 'LIVE' ? '' : ' of the bundled sample data'}.
                It is a lead for review and does not establish identity, coordination, or criminal activity.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
