import React from 'react';
import { EntityNode } from '../types';

interface NodeAvatarCharacterProps {
  node: EntityNode;
  isSelected: boolean;
  isHovered: boolean;
  pedestalColor: string;
  hideInternalLabels?: boolean;
}

export const NodeAvatarCharacter: React.FC<NodeAvatarCharacterProps> = ({
  node,
  isSelected,
  isHovered,
  pedestalColor,
  hideInternalLabels = false,
}) => {
  const isHero = Boolean(node.isHero || node.id === 'raj.pay@oksbi');
  const isSeller = node.id === '@seller_raj';
  const isCrypto = node.id === 'bc1qar...mdq' || node.type === 'crypto';
  const isPhone = node.id === '9876543210' || node.type === 'phone';
  const isPost = node.type === 'post';

  // Role badge text and dimensions
  let roleText = 'NODE';
  let badgeWidth = 44;

  if (isHero) {
    roleText = 'HERO NEXUS';
    badgeWidth = 52;
  } else if (isSeller) {
    roleText = 'DARK SELLER';
    badgeWidth = 50;
  } else if (isCrypto) {
    roleText = 'CRYPTO ESCROW';
    badgeWidth = 56;
  } else if (isPhone) {
    roleText = 'ARMS BROKER';
    badgeWidth = 50;
  } else if (node.id === 'post_001') {
    roleText = 'NARCOTICS';
    badgeWidth = 46;
  } else if (node.id === 'post_002') {
    roleText = 'MULE BAZAAR';
    badgeWidth = 50;
  } else if (node.id === 'post_003') {
    roleText = 'ARMS HUB';
    badgeWidth = 44;
  } else if (node.id === 'post_004') {
    roleText = 'DOC FORGE';
    badgeWidth = 46;
  } else if (node.id === 'post_005') {
    roleText = 'BORDER DROP';
    badgeWidth = 50;
  } else if (isPost) {
    roleText = 'POST INTEL';
    badgeWidth = 46;
  }

  // Unique SVG prefix to avoid defs collision
  const uid = node.id.replace(/[^a-zA-Z0-9]/g, '_');

  return (
    <g className="transition-transform duration-200 select-none">
      <defs>
        {/* Volumetric 3D Skin Gradient */}
        <radialGradient id={`skin_${uid}`} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#92400e" />
        </radialGradient>

        {/* Hero Vertical Hologram Beam Gradient */}
        <linearGradient id={`beam_${uid}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.4" />
          <stop offset="60%" stopColor="#00e5ff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
        </linearGradient>

        {/* Tech Jacket Gradients */}
        <linearGradient id={`jacket_${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#090d16" />
        </linearGradient>

        {/* Visor Cyan Gradient */}
        <linearGradient id={`visor_cyan_${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#00e5ff" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>

        {/* Visor Emerald Gradient */}
        <linearGradient id={`visor_green_${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>

        {/* Visor Amber Gradient */}
        <linearGradient id={`visor_amber_${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>

        {/* Visor Crimson Gradient */}
        <linearGradient id={`visor_red_${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
      </defs>

      {/* ======================================================== */}
      {/* 1. HOLOGRAPHIC NEON PEDESTAL (Positioned at y = 0)      */}
      {/* ======================================================== */}
      <g>
        {/* Hero Light Beam Cone */}
        {isHero && (
          <polygon
            points="-18,0 18,0 24,-48 -24,-48"
            fill={`url(#beam_${uid})`}
            pointerEvents="none"
          />
        )}

        {/* Selected / Hero Outer Pulsing Ping Ring */}
        {(isHero || isSelected) && (
          <ellipse
            cx="0"
            cy="0"
            rx="23"
            ry="7.8"
            fill="none"
            stroke={pedestalColor}
            strokeWidth="1.2"
            className="animate-ping"
            opacity="0.5"
            pointerEvents="none"
          />
        )}

        {/* Main Base Outer Ring */}
        <ellipse
          cx="0"
          cy="0"
          rx={isHero ? '21' : '18'}
          ry={isHero ? '7' : '6'}
          fill={pedestalColor}
          fillOpacity={isSelected ? 0.28 : isHovered ? 0.22 : 0.14}
          stroke={pedestalColor}
          strokeWidth={isSelected ? 2 : 1.4}
        />

        {/* Concentric Inner Disc */}
        <ellipse
          cx="0"
          cy="0"
          rx={isHero ? '13' : '11'}
          ry={isHero ? '4.2' : '3.6'}
          fill={pedestalColor}
          fillOpacity={isSelected ? 0.45 : 0.28}
          stroke={pedestalColor}
          strokeWidth="0.8"
        />

        {/* Pedestal Core Glow Point */}
        <ellipse
          cx="0"
          cy="0"
          rx="5"
          ry="1.8"
          fill="#ffffff"
          opacity={isSelected ? 0.9 : 0.6}
        />

        {/* Drop Shadow Under Character Feet */}
        <ellipse cx="0" cy="-2.5" rx="9" ry="2.6" fill="#000000" opacity="0.65" />
      </g>

      {/* ======================================================== */}
      {/* 2. 3D-SHADED CHIBI CHARACTER AVATAR                     */}
      {/* ======================================================== */}
      <g
        transform={`translate(0, ${isHovered || isSelected ? -2 : 0})`}
        className="transition-transform duration-150"
      >
        {/* ----------------- CASE A: HERO / UPI NEXUS ----------------- */}
        {isHero && (
          <g>
            {/* Tech Jacket Torso */}
            <path
              d="M -8,-5 L -7,-18 L 7,-18 L 8,-5 Q 0,-2 -8,-5 Z"
              fill={`url(#jacket_${uid})`}
              stroke="#00e5ff"
              strokeWidth="0.8"
            />
            {/* Cyan Neon Zipper Line & Tech Collar */}
            <line x1="0" y1="-18" x2="0" y2="-5" stroke="#00e5ff" strokeWidth="1.2" />
            <polygon points="-3,-18 3,-18 0,-15" fill="#00e5ff" />

            {/* Left & Right Sleeves / Arms */}
            <path
              d="M -7,-17 L -10,-10 L -8,-5 L -6,-12"
              fill="#0f172a"
              stroke="#00e5ff"
              strokeWidth="0.6"
            />
            <path
              d="M 7,-17 L 10,-10 L 8,-5 L 6,-12"
              fill="#0f172a"
              stroke="#00e5ff"
              strokeWidth="0.6"
            />

            {/* Neck */}
            <rect x="-3" y="-20" width="6" height="3" fill="#b45309" />

            {/* 3D Round Chibi Head */}
            <circle
              cx="0"
              cy="-27"
              r="9"
              fill={`url(#skin_${uid})`}
              stroke="#b45309"
              strokeWidth="0.6"
            />

            {/* Futuristic Cyan Smart Visor */}
            <path
              d="M -7,-28 Q 0,-26 7,-28 L 6.5,-25 Q 0,-23 -6.5,-25 Z"
              fill={`url(#visor_cyan_${uid})`}
            />
            <line
              x1="-5"
              y1="-26.5"
              x2="5"
              y2="-26.5"
              stroke="#ffffff"
              strokeWidth="0.6"
              strokeOpacity="0.85"
            />

            {/* Sleek Over-Ear Cyber-Headphones */}
            <path
              d="M -9.5,-27 C -9.5,-38 9.5,-38 9.5,-27"
              fill="none"
              stroke="#64748b"
              strokeWidth="1.6"
            />
            <rect
              x="-11.5"
              y="-30"
              width="3.2"
              height="6.5"
              rx="1.6"
              fill="#00e5ff"
              stroke="#ffffff"
              strokeWidth="0.5"
            />
            <rect
              x="8.3"
              y="-30"
              width="3.2"
              height="6.5"
              rx="1.6"
              fill="#00e5ff"
              stroke="#ffffff"
              strokeWidth="0.5"
            />

            {/* Spiky Tech Cyber Hair */}
            <path
              d="M -8,-32 Q -5,-38 -1,-36 Q 4,-39 8,-33 Q 6,-35 0,-33 Q -5,-35 -8,-32 Z"
              fill="#0f172a"
            />
            {/* Hair highlight */}
            <path d="M -3,-36 Q 1,-37 4,-35" stroke="#00e5ff" strokeWidth="0.8" fill="none" />
          </g>
        )}

        {/* ----------------- CASE B: SELLER (@seller_raj) ----------------- */}
        {isSeller && (
          <g>
            {/* Dark Tech Hoodie Body */}
            <path
              d="M -8,-5 L -7,-18 L 7,-18 L 8,-5 Q 0,-2 -8,-5 Z"
              fill={`url(#jacket_${uid})`}
              stroke="#10b981"
              strokeWidth="0.8"
            />

            {/* Glowing Mini Laptop held in front */}
            <polygon
              points="-8,-9 8,-9 6,-4 -6,-4"
              fill="#1e293b"
              stroke="#334155"
              strokeWidth="0.5"
            />
            <polygon
              points="-6,-16 6,-16 8,-9 -8,-9"
              fill="#064e3b"
              stroke="#10b981"
              strokeWidth="0.8"
            />
            {/* Laptop Screen Code Lines */}
            <line x1="-4.5" y1="-14" x2="3" y2="-14" stroke="#34d399" strokeWidth="0.6" />
            <line x1="-4.5" y1="-12" x2="5" y2="-12" stroke="#34d399" strokeWidth="0.6" />
            <line x1="-4.5" y1="-10" x2="1" y2="-10" stroke="#34d399" strokeWidth="0.6" />

            {/* Large Dark Hood Over Head */}
            <path
              d="M -10,-19 C -12,-38 12,-38 10,-19 C 7,-17 -7,-17 -10,-19 Z"
              fill="#090d16"
              stroke="#10b981"
              strokeWidth="0.8"
            />

            {/* Shadow Face under Hood */}
            <ellipse cx="0" cy="-26" rx="6.5" ry="5.8" fill="#020617" />

            {/* Glowing Emerald Eyes / HUD slit */}
            <ellipse cx="-2.5" cy="-26" rx="1.6" ry="0.9" fill="#10b981" />
            <ellipse cx="2.5" cy="-26" rx="1.6" ry="0.9" fill="#10b981" />
            <circle cx="-2.5" cy="-26" r="0.5" fill="#ffffff" />
            <circle cx="2.5" cy="-26" r="0.5" fill="#ffffff" />
          </g>
        )}

        {/* ----------------- CASE C: CRYPTO (bc1qar...mdq) ----------------- */}
        {isCrypto && !isHero && !isSeller && (
          <g>
            {/* Stealth Black Trench Hoodie */}
            <path
              d="M -8,-5 L -7,-18 L 7,-18 L 8,-5 Q 0,-2 -8,-5 Z"
              fill="#111827"
              stroke="#ef4444"
              strokeWidth="0.8"
            />
            {/* Crimson Crypto Chevron */}
            <polygon points="0,-15 3,-12 0,-9 -3,-12" fill="#ef4444" opacity="0.9" />

            {/* Ninja Stealth Cowl */}
            <path
              d="M -9.5,-19 C -11.5,-37 11.5,-37 9.5,-19 C 6,-17 -6,-17 -9.5,-19 Z"
              fill="#18181b"
              stroke="#3f3f46"
              strokeWidth="0.7"
            />

            {/* Glowing Crimson Visor Slit */}
            <rect
              x="-6.5"
              y="-27"
              width="13"
              height="2.6"
              rx="1.2"
              fill={`url(#visor_red_${uid})`}
            />
            <line
              x1="-4.5"
              y1="-25.7"
              x2="4.5"
              y2="-25.7"
              stroke="#ffffff"
              strokeWidth="0.6"
              strokeOpacity="0.9"
            />

            {/* Floating Glowing Crypto Coin Token */}
            <circle
              cx="-11"
              cy="-14"
              r="3.5"
              fill="#ef4444"
              stroke="#ffffff"
              strokeWidth="0.6"
            />
            <text
              x="-11"
              y="-12.7"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="3.2"
              fontWeight="bold"
            >
              ₿
            </text>
          </g>
        )}

        {/* ----------------- CASE D: PHONE (9876543210) ----------------- */}
        {isPhone && !isHero && !isSeller && !isCrypto && (
          <g>
            {/* Tactical Urban Street Jacket */}
            <path
              d="M -8,-5 L -7,-18 L 7,-18 L 8,-5 Q 0,-2 -8,-5 Z"
              fill="#1f2937"
              stroke="#f59e0b"
              strokeWidth="0.8"
            />

            {/* Hand Holding Glowing Radio Phone */}
            <rect
              x="8"
              y="-16"
              width="4.5"
              height="8"
              rx="1"
              fill="#0f172a"
              stroke="#f59e0b"
              strokeWidth="0.8"
            />
            <rect x="9" y="-15" width="2.5" height="4" rx="0.5" fill="#f59e0b" opacity="0.95" />
            <line x1="10" y1="-16" x2="10" y2="-19" stroke="#94a3b8" strokeWidth="0.8" />
            {/* Radio Signal Arcs */}
            <path
              d="M 12,-18 C 13.5,-18.5 14.5,-19.5 14.5,-21"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="0.7"
              opacity="0.85"
            />

            {/* Neck */}
            <rect x="-3" y="-20" width="6" height="3" fill="#b45309" />

            {/* Head */}
            <circle
              cx="0"
              cy="-27"
              r="9"
              fill={`url(#skin_${uid})`}
              stroke="#b45309"
              strokeWidth="0.6"
            />

            {/* Short Tactical Haircut */}
            <path
              d="M -8.5,-30 Q 0,-35 8.5,-30 L 8,-28 Q 0,-31 -8,-28 Z"
              fill="#374151"
            />

            {/* Amber Cyber Visor */}
            <path
              d="M -7,-28 L 7,-28 L 6,-25 L -6,-25 Z"
              fill={`url(#visor_amber_${uid})`}
            />
            <line
              x1="-5"
              y1="-26.5"
              x2="5"
              y2="-26.5"
              stroke="#ffffff"
              strokeWidth="0.6"
              strokeOpacity="0.9"
            />
          </g>
        )}

        {/* ----------------- CASE E: POST NODES (Unique Styles) ----------------- */}
        {isPost && (
          <g>
            {/* Style 1: post_001 (Orange/Red Streetwear & Cap) */}
            {node.id === 'post_001' && (
              <g>
                <path
                  d="M -7,-5 L -6,-17 L 6,-17 L 7,-5 Z"
                  fill="#c2410c"
                  stroke="#f97316"
                  strokeWidth="0.6"
                />
                <line x1="0" y1="-17" x2="0" y2="-5" stroke="#fed7aa" strokeWidth="0.8" />
                <circle cx="0" cy="-26" r="8" fill={`url(#skin_${uid})`} stroke="#b45309" strokeWidth="0.5" />
                {/* Backwards Red Cap */}
                <path d="M -8,-28 C -8,-36 8,-36 8,-28 Z" fill="#dc2626" />
                <rect x="6" y="-28" width="4" height="1.5" rx="0.5" fill="#991b1b" />
                {/* Eyes & Smile */}
                <circle cx="-2.5" cy="-25" r="0.9" fill="#0f172a" />
                <circle cx="2.5" cy="-25" r="0.9" fill="#0f172a" />
                <path d="M -1.5,-23 Q 0,-21.5 1.5,-23" fill="none" stroke="#92400e" strokeWidth="0.6" />
              </g>
            )}

            {/* Style 2: post_002 (Blue Knit Sweater & Card) */}
            {node.id === 'post_002' && (
              <g>
                <path
                  d="M -7,-5 L -6,-17 L 6,-17 L 7,-5 Z"
                  fill="#1e3a8a"
                  stroke="#3b82f6"
                  strokeWidth="0.6"
                />
                {/* Collared shirt underneath */}
                <polygon points="0,-14 -2.5,-17 2.5,-17" fill="#ffffff" />
                {/* Bank / ATM card in hand */}
                <rect
                  x="7"
                  y="-11"
                  width="4.5"
                  height="3"
                  rx="0.5"
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="0.4"
                />
                <circle cx="0" cy="-26" r="8" fill={`url(#skin_${uid})`} stroke="#b45309" strokeWidth="0.5" />
                {/* Neat side-part hair */}
                <path d="M -8,-28 C -8,-35 8,-35 8,-28 C 4,-33 -4,-33 -8,-28 Z" fill="#1e293b" />
                <circle cx="-2.5" cy="-25" r="0.9" fill="#0f172a" />
                <circle cx="2.5" cy="-25" r="0.9" fill="#0f172a" />
              </g>
            )}

            {/* Style 3: post_003 (Tactical Camo Vest) */}
            {node.id === 'post_003' && (
              <g>
                <path
                  d="M -7,-5 L -6,-17 L 6,-17 L 7,-5 Z"
                  fill="#3f3f46"
                  stroke="#f59e0b"
                  strokeWidth="0.6"
                />
                <rect
                  x="-4"
                  y="-16"
                  width="8"
                  height="10"
                  rx="1"
                  fill="#365314"
                  stroke="#4d7c0f"
                  strokeWidth="0.5"
                />
                <circle cx="0" cy="-26" r="8" fill={`url(#skin_${uid})`} stroke="#b45309" strokeWidth="0.5" />
                {/* Crew cut cap */}
                <path d="M -8,-28 C -7,-35 7,-35 8,-28 Z" fill="#4b5563" />
                <circle cx="-2.5" cy="-25" r="0.9" fill="#0f172a" />
                <circle cx="2.5" cy="-25" r="0.9" fill="#0f172a" />
              </g>
            )}

            {/* Style 4: post_004 (Purple Cardigan & Round Glasses) */}
            {node.id === 'post_004' && (
              <g>
                <path
                  d="M -7,-5 L -6,-17 L 6,-17 L 7,-5 Z"
                  fill="#581c87"
                  stroke="#a855f7"
                  strokeWidth="0.6"
                />
                {/* Lanyard with document pass */}
                <path d="M -3,-17 L 0,-10 L 3,-17" fill="none" stroke="#22d3ee" strokeWidth="0.5" />
                <rect x="-1.5" y="-10" width="3" height="4" rx="0.5" fill="#ffffff" />
                <circle cx="0" cy="-26" r="8" fill={`url(#skin_${uid})`} stroke="#b45309" strokeWidth="0.5" />
                {/* Wavy styled brown hair */}
                <path d="M -8,-29 C -9,-36 9,-36 8,-29 C 4,-33 0,-34 -8,-29 Z" fill="#78350f" />
                {/* Round smart glasses */}
                <circle cx="-2.5" cy="-25" r="2.2" fill="none" stroke="#a855f7" strokeWidth="0.6" />
                <circle cx="2.5" cy="-25" r="2.2" fill="none" stroke="#a855f7" strokeWidth="0.6" />
                <line x1="-0.3" y1="-25" x2="0.3" y2="-25" stroke="#a855f7" strokeWidth="0.5" />
              </g>
            )}

            {/* Style 5: post_005 (Teal Winter Windbreaker & Beanie) */}
            {node.id === 'post_005' && (
              <g>
                <path
                  d="M -7,-5 L -6,-17 L 6,-17 L 7,-5 Z"
                  fill="#134e4a"
                  stroke="#14b8a6"
                  strokeWidth="0.6"
                />
                <circle cx="0" cy="-26" r="8" fill={`url(#skin_${uid})`} stroke="#b45309" strokeWidth="0.5" />
                {/* Teal Knitted Beanie Hat */}
                <path d="M -8,-27 C -9,-36 9,-36 8,-27 Z" fill="#0d9488" stroke="#14b8a6" strokeWidth="0.5" />
                <circle cx="0" cy="-35.5" r="1.6" fill="#ccfbf1" />
                <circle cx="-2.5" cy="-25" r="0.9" fill="#0f172a" />
                <circle cx="2.5" cy="-25" r="0.9" fill="#0f172a" />
              </g>
            )}
          </g>
        )}
      </g>

      {/* ======================================================== */}
      {/* 3. NODE LABEL & ROLE BADGE (Below Pedestal)             */}
      {/* ======================================================== */}
      {!hideInternalLabels && (
        <g>
          {/* Node Identifier Label */}
          <text
            x="0"
            y="13"
            textAnchor="middle"
            fill={isSelected ? '#00e5ff' : isHovered ? '#ffffff' : '#e2e8f0'}
            fontSize="7.5"
            fontWeight={isSelected || isHero ? 'bold' : 'normal'}
            fontFamily="monospace"
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
              textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.9)',
            }}
          >
            {node.label}
          </text>

          {/* Role Pill Badge */}
          <g transform="translate(0, 24)" style={{ pointerEvents: 'none' }}>
            <rect
              x={-badgeWidth / 2}
              y="-6"
              width={badgeWidth}
              height="10.5"
              rx="3"
              fill={`${pedestalColor}20`}
              stroke={pedestalColor}
              strokeWidth="0.75"
            />
            <text
              x="0"
              y="1.5"
              textAnchor="middle"
              fill={pedestalColor}
              fontSize="6"
              fontFamily="monospace"
              fontWeight="bold"
              letterSpacing="0.3"
            >
              {roleText}
            </text>
          </g>
        </g>
      )}
    </g>
  );
};
