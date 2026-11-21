import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { geoCentroid } from 'd3-geo';
import { DistrictIntel, DistrictConnection, CrimeCategory } from '../types';
import { RAJASTHAN_DISTRICTS } from '../data/mockData';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Line,
  ZoomableGroup,
} from 'react-simple-maps';
import { sound } from '../utils/audio';

const rajasthanGeoUrl = '/rajasthan-districts.json';
const DEFAULT_CENTER: [number, number] = [73.9, 26.7];

// District name normalization map for 2011 Census TopoJSON spellings and common variations
export const DISTRICT_NAME_NORMALIZATION: Record<string, string> = {
  ganganagar: 'Sri Ganganagar',
  jalor: 'Jalore',
  jhunjhunun: 'Jhunjhunu',
  chittaurgarh: 'Chittorgarh',
  dhaulpur: 'Dholpur',
  'sri ganganagar': 'Sri Ganganagar',
  jalore: 'Jalore',
  jhunjhunu: 'Jhunjhunu',
  chittorgarh: 'Chittorgarh',
  dholpur: 'Dholpur',
  'sawai madhopur': 'Sawai Madhopur',
  sawaimadhopur: 'Sawai Madhopur',
};

export const normalizeDistrictName = (rawName?: string | null): string => {
  if (!rawName) return '';
  const clean = rawName.trim().toLowerCase();
  return DISTRICT_NAME_NORMALIZATION[clean] || rawName.trim();
};

// Static coordinate fallback table for all 33 Rajasthan districts
const DISTRICT_COORDINATES: Record<string, [number, number]> = {
  churu: [74.695, 28.3439],
  jhunjhunu: [75.5499, 28.092],
  jaisalmer: [70.8995, 27.0748],
  sikar: [75.2888, 27.6337],
  alwar: [76.6014, 27.5903],
  jaipur: [75.7179, 26.9764],
  jodhpur: [72.7872, 26.7466],
  bharatpur: [77.2761, 27.2476],
  nagaur: [74.1748, 27.0661],
  dausa: [76.5086, 26.8567],
  karauli: [76.9593, 26.522],
  dholpur: [77.7006, 26.681],
  barmer: [71.4742, 25.7348],
  'sawai madhopur': [76.4612, 26.2177],
  'sawai-madhopur': [76.4612, 26.2177],
  tonk: [75.6663, 26.1486],
  pali: [73.5178, 25.7065],
  bhilwara: [74.7272, 25.4806],
  jalore: [72.2099, 25.0989],
  bundi: [75.7913, 25.4879],
  kota: [76.1033, 25.1093],
  sirohi: [72.7765, 24.7618],
  baran: [76.7477, 24.9949],
  udaipur: [73.6897, 24.4183],
  jhalawar: [76.1919, 24.3359],
  dungarpur: [73.8535, 23.731],
  banswara: [74.3644, 23.4781],
  ajmer: [74.7722, 26.2326],
  rajsamand: [73.8902, 25.2271],
  chittorgarh: [74.7742, 24.8219],
  ganganagar: [73.5694, 29.3956],
  'sri ganganagar': [73.5694, 29.3956],
  'sri-ganganagar': [73.5694, 29.3956],
  hanumangarh: [74.5623, 29.266],
  bikaner: [73.174, 28.177],
  pratapgarh: [74.6514, 24.029],
};

interface RajasthanMapProps {
  districts: DistrictIntel[];
  connections: DistrictConnection[];
  selectedDistrict: DistrictIntel | null;
  onSelectDistrict: (district: DistrictIntel) => void;
  activeCategory: CrimeCategory | 'ALL';
}

export const RajasthanMap: React.FC<RajasthanMapProps> = ({
  districts = RAJASTHAN_DISTRICTS,
  connections,
  selectedDistrict,
  onSelectDistrict,
  activeCategory,
}) => {
  const [hoveredDistrict, setHoveredDistrict] = useState<DistrictIntel | null>(null);
  const [showArcs, setShowArcs] = useState(true);
  const [showRadar, setShowRadar] = useState(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);

  // Filter connections by active category
  const filteredConnections = connections.filter((conn) => {
    if (activeCategory === 'ALL') return true;
    return conn.category === activeCategory;
  });

  const getDistrictById = (id: string) =>
    districts.find((d) => d.id.toLowerCase() === id.toLowerCase());

  const getDistrictByName = (rawName?: string | null) => {
    if (!rawName) return undefined;
    const normalized = normalizeDistrictName(rawName).toLowerCase();
    const rawClean = rawName.trim().toLowerCase();

    return districts.find((d) => {
      const dNorm = normalizeDistrictName(d.name).toLowerCase();
      const dClean = d.name.trim().toLowerCase();
      const dId = d.id.toLowerCase().replace(/-/g, ' ');

      return (
        dNorm === normalized ||
        dClean === rawClean ||
        dClean === normalized ||
        dNorm === rawClean ||
        dId === normalized ||
        dId === rawClean
      );
    });
  };

  const getDistrictCoordinates = (
    d: DistrictIntel,
    dynamicMap?: Map<string, [number, number]>
  ): [number, number] | null => {
    // 1. Direct coordinates on district object
    if (d.coordinates && d.coordinates.length === 2) {
      return d.coordinates;
    }

    // 2. Dynamic centroid map computed from TopoJSON
    if (dynamicMap) {
      const norm = normalizeDistrictName(d.name).toLowerCase();
      if (dynamicMap.has(norm)) return dynamicMap.get(norm)!;
      if (dynamicMap.has(d.name.toLowerCase())) return dynamicMap.get(d.name.toLowerCase())!;
      if (dynamicMap.has(d.id.toLowerCase())) return dynamicMap.get(d.id.toLowerCase())!;
    }

    // 3. Static table fallback
    const idKey = d.id.toLowerCase();
    if (DISTRICT_COORDINATES[idKey]) return DISTRICT_COORDINATES[idKey];
    const nameKey = d.name.toLowerCase().trim();
    if (DISTRICT_COORDINATES[nameKey]) return DISTRICT_COORDINATES[nameKey];
    const stripped = nameKey.replace(/^sri\s+/, '');
    if (DISTRICT_COORDINATES[stripped]) return DISTRICT_COORDINATES[stripped];

    return null;
  };

  const getCategoryColor = (cat: CrimeCategory) => {
    switch (cat) {
      case 'DRUGS':
        return '#FF3B30'; // red
      case 'ARMS':
        return '#F59E0B'; // amber/orange
      case 'DOCUMENTS':
        return '#8B5CF6'; // purple
      case 'FINANCIAL':
        return '#10B981'; // emerald
    }
  };

  const getConnectionColor = (conn: DistrictConnection) => {
    if (conn.type === 'UPI') return '#22d3ee'; // cyan
    if (conn.type === 'PHONE' || conn.category === 'ARMS') return '#f59e0b'; // amber
    if (conn.type === 'CRYPTO' || conn.category === 'DRUGS') return '#ef4444'; // crimson
    return getCategoryColor(conn.category);
  };

  const getThreatColor = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return '#FF3B30';
      case 'HIGH':
        return '#F59E0B';
      case 'ELEVATED':
        return '#00E5FF';
      default:
        return '#64748B';
    }
  };

  return (
    <div className="relative w-full h-full bg-[#070a0f] rounded-2xl border border-slate-800 overflow-hidden flex flex-col select-none touch-none">
      {/* Background Radar Grid & Coordinates */}
      <div className="absolute inset-0 radar-grid opacity-60 pointer-events-none" />
      <div className="absolute inset-0 crt-overlay opacity-30 pointer-events-none" />

      {/* Map Header Overlay Bar */}
      <div className="relative z-20 bg-[#0c121b]/85 backdrop-blur-md px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-white font-bold">RAJASTHAN TACTICAL GIS // THREAT RADAR</span>
          <span className="text-slate-500 hidden sm:inline">|</span>
          <span className="text-cyan-400 hidden sm:inline">PROJECTION: EPSG:4326 // WGS 84</span>
        </div>

        {/* Tactical Map Toggles */}
        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          <button
            onClick={() => {
              sound.playClick();
              setShowArcs(!showArcs);
            }}
            className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors ${
              showArcs
                ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-900 border-slate-700 text-slate-500'
            }`}
          >
            SYNDICATE ARCS: {showArcs ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setShowRadar(!showRadar);
            }}
            className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors ${
              showRadar
                ? 'bg-red-950/80 border-red-500/50 text-red-300'
                : 'bg-slate-900 border-slate-700 text-slate-500'
            }`}
          >
            RADAR: {showRadar ? 'ON' : 'OFF'}
          </button>

          <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
            <button
              onClick={() => {
                sound.playClick();
                setZoomLevel((prev) => Math.min(prev + 0.3, 4));
              }}
              className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setZoomLevel((prev) => Math.max(prev - 0.3, 0.8));
              }}
              className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setZoomLevel(1);
                setMapCenter(DEFAULT_CENTER);
              }}
              className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded"
              title="Reset Zoom & Pan"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Vector Canvas */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center p-2 overflow-hidden touch-none cursor-grab active:cursor-grabbing">
        {/* Animated Radar Sweep Overlay */}
        {showRadar && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <div className="w-[580px] h-[580px] rounded-full border border-cyan-500/30 relative">
              <div className="absolute inset-0 rounded-full border border-dashed border-cyan-500/20" />
              <div className="absolute inset-16 rounded-full border border-cyan-500/20" />
              <div className="absolute inset-32 rounded-full border border-cyan-500/20" />
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-transparent via-transparent to-cyan-500/20 animate-radar-sweep origin-center" />
            </div>
          </div>
        )}

        <div className="w-full h-full flex items-center justify-center touch-none">
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{
              center: DEFAULT_CENTER,
              scale: 4200,
            }}
            style={{ width: '100%', height: '100%' }}
          >
            <ZoomableGroup
              center={mapCenter}
              zoom={zoomLevel}
              minZoom={0.8}
              maxZoom={4}
              onMoveEnd={({ coordinates, zoom }) => {
                if (coordinates) setMapCenter(coordinates);
                if (typeof zoom === 'number') setZoomLevel(zoom);
              }}
            >
              <Geographies geography={rajasthanGeoUrl}>
                {({ geographies, borders, outline }) => {
                  // Dynamically compute centroids for all geographies via geoCentroid(geo)
                  const dynamicCentroidMap = new Map<string, [number, number]>();
                  geographies.forEach((geo) => {
                    const rawName = (geo.properties as Record<string, any> | null)?.district as
                      | string
                      | undefined;
                    if (rawName) {
                      const centroid = geoCentroid(geo) as [number, number];
                      dynamicCentroidMap.set(rawName.toLowerCase(), centroid);
                      dynamicCentroidMap.set(normalizeDistrictName(rawName).toLowerCase(), centroid);
                    }
                  });

                  return (
                    <>
                      {/* Base Geographic District Boundaries & Threat Theming */}
                      {geographies.map((geo) => {
                        const topoName = (geo.properties as Record<string, any> | null)?.district as
                          | string
                          | undefined;
                        const matchedDistrict = getDistrictByName(topoName);
                        const normalizedTopo = normalizeDistrictName(topoName).toLowerCase();
                        const isSelected = Boolean(
                          selectedDistrict &&
                            (selectedDistrict.id === matchedDistrict?.id ||
                              normalizeDistrictName(selectedDistrict.name).toLowerCase() ===
                                normalizedTopo)
                        );
                        const isHovered = Boolean(
                          hoveredDistrict &&
                            (hoveredDistrict.id === matchedDistrict?.id ||
                              normalizeDistrictName(hoveredDistrict.name).toLowerCase() ===
                                normalizedTopo)
                        );
                        const threatStroke = matchedDistrict
                          ? getThreatColor(matchedDistrict.threatLevel)
                          : '#1e293b';
                        const fillColor = matchedDistrict
                          ? isSelected
                            ? '#0e3a4e'
                            : isHovered
                            ? '#164e63'
                            : '#0b1320'
                          : '#070c14';

                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onMouseEnter={() => {
                              if (matchedDistrict) setHoveredDistrict(matchedDistrict);
                            }}
                            onMouseLeave={() => setHoveredDistrict(null)}
                            onClick={() => {
                              if (matchedDistrict) {
                                sound.playClick();
                                onSelectDistrict(matchedDistrict);
                              }
                            }}
                            fill={fillColor}
                            stroke={isSelected ? '#22d3ee' : isHovered ? '#38bdf8' : threatStroke}
                            strokeWidth={isSelected ? 1.6 : isHovered ? 1.2 : 0.6}
                            style={{
                              outline: 'none',
                              cursor: matchedDistrict ? 'pointer' : 'default',
                              transition: 'fill 0.2s, stroke 0.2s',
                            }}
                          />
                        );
                      })}

                      {/* Internal District Borders */}
                      {borders?.svgPath && (
                        <path
                          d={borders.svgPath}
                          fill="none"
                          stroke="#1e293b"
                          strokeWidth={0.75}
                          pointerEvents="none"
                        />
                      )}

                      {/* Outer Rajasthan State Border */}
                      {outline?.svgPath && (
                        <path
                          d={outline.svgPath}
                          fill="none"
                          stroke="#0284c7"
                          strokeWidth={1.5}
                          pointerEvents="none"
                        />
                      )}

                      {/* Syndicate Arcs (Connections) */}
                      {showArcs &&
                        filteredConnections.map((conn) => {
                          const fromDist = getDistrictById(conn.from);
                          const toDist = getDistrictById(conn.to);
                          if (!fromDist || !toDist) return null;
                          const fromCoords = getDistrictCoordinates(fromDist, dynamicCentroidMap);
                          const toCoords = getDistrictCoordinates(toDist, dynamicCentroidMap);
                          if (!fromCoords || !toCoords) return null;

                          const arcColor = getConnectionColor(conn);

                          return (
                            <Line
                              key={conn.id}
                              from={fromCoords}
                              to={toCoords}
                              stroke={arcColor}
                              strokeWidth={1.8}
                              strokeDasharray="4 3"
                              strokeOpacity={0.85}
                              className="animate-pulse"
                              style={{ pointerEvents: 'none' }}
                            />
                          );
                        })}

                      {/* District Tactical Markers (Labels & Badges) */}
                      {districts.map((district) => {
                        const coords = getDistrictCoordinates(district, dynamicCentroidMap);
                        if (!coords) return null;

                        const isSelected =
                          selectedDistrict?.id === district.id ||
                          normalizeDistrictName(selectedDistrict?.name).toLowerCase() ===
                            normalizeDistrictName(district.name).toLowerCase();
                        const isHovered =
                          hoveredDistrict?.id === district.id ||
                          normalizeDistrictName(hoveredDistrict?.name).toLowerCase() ===
                            normalizeDistrictName(district.name).toLowerCase();
                        const threatColor = getThreatColor(district.threatLevel);

                        return (
                          <Marker
                            key={district.id}
                            coordinates={coords}
                            onClick={() => {
                              sound.playClick();
                              onSelectDistrict(district);
                            }}
                            onMouseEnter={() => setHoveredDistrict(district)}
                            onMouseLeave={() => setHoveredDistrict(null)}
                            style={{ cursor: 'pointer' }}
                          >
                            {/* Outer Pulse Ring for Selected District */}
                            {isSelected && (
                              <circle
                                r={10}
                                fill="none"
                                stroke="#22d3ee"
                                strokeWidth={1.5}
                                className="animate-ping"
                                opacity={0.75}
                              />
                            )}

                            {/* Centroid Tactical Node */}
                            <circle
                              r={isSelected ? 4 : isHovered ? 3.5 : 2.5}
                              fill={isSelected ? '#22d3ee' : isHovered ? '#38bdf8' : threatColor}
                              stroke="#070a0f"
                              strokeWidth={1}
                            />

                            {/* District Label */}
                            <text
                              textAnchor="middle"
                              y={11}
                              fill={isSelected ? '#38bdf8' : isHovered ? '#f1f5f9' : '#94a3b8'}
                              fontSize={isSelected ? 8.5 : 7}
                              fontFamily="monospace"
                              fontWeight={isSelected || isHovered ? 'bold' : 'normal'}
                              letterSpacing="0.4"
                              style={{
                                pointerEvents: 'none',
                                userSelect: 'none',
                                textShadow: '0 1px 4px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.9)',
                              }}
                            >
                              {district.name.toUpperCase()}
                            </text>

                            {/* Flagged Count Badge */}
                            {district.flaggedCount > 0 && (
                              <g transform="translate(5, -7)" style={{ pointerEvents: 'none' }}>
                                <rect
                                  x={-3}
                                  y={-6}
                                  width={district.flaggedCount > 9 ? 16 : 12}
                                  height={9}
                                  rx={2.5}
                                  fill="#090d16"
                                  stroke={threatColor}
                                  strokeWidth={0.8}
                                  opacity={0.95}
                                />
                                <text
                                  x={district.flaggedCount > 9 ? 5 : 3}
                                  y={1}
                                  textAnchor="middle"
                                  fill={threatColor}
                                  fontSize={6.5}
                                  fontFamily="monospace"
                                  fontWeight="bold"
                                >
                                  {district.flaggedCount}
                                </text>
                              </g>
                            )}
                          </Marker>
                        );
                      })}
                    </>
                  );
                }}
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
        </div>

        {/* Floating HUD Tooltip for Hovered District */}
        <AnimatePresence>
          {hoveredDistrict && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute top-14 left-4 z-30 bg-[#0a0f18]/95 backdrop-blur-md border border-cyan-500/50 p-4 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8),0_0_20px_rgba(0,229,255,0.2)] font-mono text-xs w-64 pointer-events-none"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <div className="text-white font-bold text-sm">
                    {hoveredDistrict.name}{' '}
                    <span className="text-slate-500 text-xs">({hoveredDistrict.hindiName})</span>
                  </div>
                  <div className="text-[10px] text-cyan-400">DISTRICT DOSSIER</div>
                </div>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{
                    backgroundColor: `${getThreatColor(hoveredDistrict.threatLevel)}20`,
                    color: getThreatColor(hoveredDistrict.threatLevel),
                    border: `1px solid ${getThreatColor(hoveredDistrict.threatLevel)}40`,
                  }}
                >
                  {hoveredDistrict.threatLevel}
                </span>
              </div>

              <div className="mt-3 space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Flagged Cases:</span>
                  <span className="text-red-400 font-bold">
                    {hoveredDistrict.flaggedCount} alerts
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Top Threats:</span>
                  <span className="text-slate-200">
                    {hoveredDistrict.topCategories.join(', ')}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400 text-[10px]">Active Channels:</span>
                  <div className="text-cyan-300 text-[10px] truncate">
                    {hoveredDistrict.activeChannels.join(', ')}
                  </div>
                </div>

                <div className="text-right text-[9px] text-cyan-400/80 pt-1">
                  CLICK TO DRILL-DOWN DOSSIER
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected District Callout (Bottom Bar on Map) */}
        {selectedDistrict && (
          <div className="absolute bottom-4 left-4 right-4 z-20 bg-[#0c131e]/90 backdrop-blur-md border border-cyan-400/60 p-3 rounded-xl flex items-center justify-between font-mono text-xs shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-400 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <div className="text-white font-bold flex items-center gap-2">
                  <span>{selectedDistrict.name.toUpperCase()} FOCUS ACTIVE</span>
                  <span className="text-red-400 text-[10px] font-bold">
                    [{selectedDistrict.flaggedCount} INTERCEPTS]
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Top Entity: {selectedDistrict.topIdentifiers[0]} | Channels:{' '}
                  {selectedDistrict.activeChannels.join(', ')}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                sound.playClick();
                onSelectDistrict(selectedDistrict);
              }}
              className="bg-cyan-500 hover:bg-cyan-400 text-black px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-[0_0_15px_rgba(0,229,255,0.4)]"
            >
              VIEW DISTRICT DOSSIER
            </button>
          </div>
        )}
      </div>

      {/* Map Legend Footer */}
      <div className="relative z-10 bg-[#090d14] px-4 py-2 border-t border-slate-800 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-4">
          <span className="text-slate-500">LEGEND:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            <span className="text-slate-300">CRITICAL</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
            <span className="text-slate-300">HIGH</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
            <span className="text-slate-300">ELEVATED</span>
          </span>
        </div>

        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-cyan-400">● CYAN ARC: UPI MULE LINK</span>
          <span className="text-amber-400">● AMBER ARC: ARMS BROKER PHONE</span>
          <span className="text-red-400">● CRIMSON ARC: CRYPTO ESCROW</span>
        </div>
      </div>
    </div>
  );
};
