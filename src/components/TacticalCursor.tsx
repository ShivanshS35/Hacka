import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';

interface Shockwave {
  id: number;
  x: number;
  y: number;
}

interface TrailParticle {
  id: number;
  x: number;
  y: number;
  size: number;
}

export const TacticalCursor: React.FC = () => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [shockwaves, setShockwaves] = useState<Shockwave[]>([]);
  const [particles, setParticles] = useState<TrailParticle[]>([]);

  // 1. Direct 1:1 hardware coordinates (Zero spring delay on pointer tip)
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  // 2. Secondary physics ONLY on decorative visual aura:
  // - Reticle spring trail (trails smoothly behind the cursor and locks on hover)
  const reticleSpringX = useSpring(mouseX, { damping: 28, stiffness: 360 });
  const reticleSpringY = useSpring(mouseY, { damping: 28, stiffness: 360 });

  // - Dynamic velocity tilt spring
  const mouseTilt = useMotionValue(0);
  const springTilt = useSpring(mouseTilt, { damping: 22, stiffness: 300 });

  // - Dynamic thruster jet flame spring
  const thrusterRaw = useMotionValue(0.7);
  const springThruster = useSpring(thrusterRaw, { damping: 22, stiffness: 320 });
  const springThrusterWidth = useTransform(springThruster, (val) => Math.min(val, 1.45));

  const prevPos = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const lastParticleTime = useRef<number>(0);
  const lastTargetRef = useRef<EventTarget | null>(null);
  const particleIdCounter = useRef(0);
  const shockwaveIdCounter = useRef(0);

  // Check if touch / mobile device (disable custom cursor on coarse touchscreens)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const matchCoarse = window.matchMedia('(pointer: coarse)');
      setIsTouchDevice(matchCoarse.matches);

      const handleChange = (e: MediaQueryListEvent) => {
        setIsTouchDevice(e.matches);
      };

      matchCoarse.addEventListener('change', handleChange);
      return () => matchCoarse.removeEventListener('change', handleChange);
    }
  }, []);

  // High-performance pointer tracking with zero-latency 1:1 hardware sync
  useEffect(() => {
    if (isTouchDevice) return;

    const handlePointerMove = (e: PointerEvent) => {
      const x = e.clientX;
      const y = e.clientY;

      // Make visible immediately on first move
      if (!isVisible) setIsVisible(true);

      // Instant 1:1 position update (bypasses React re-render & spring delay)
      mouseX.set(x);
      mouseY.set(y);

      const now = performance.now();
      const dt = Math.max(now - prevPos.current.time, 1);
      const dx = x - prevPos.current.x;
      const dy = y - prevPos.current.y;
      const currentSpeed = Math.sqrt(dx * dx + dy * dy) / dt;

      // Secondary physics: banking/tilt angle based on horizontal velocity
      const targetTilt = Math.max(Math.min(dx * 0.9, 20), -20);
      mouseTilt.set(targetTilt);

      // Secondary physics: dynamic thruster flare scaling
      const targetThruster = Math.min(Math.max(currentSpeed * 0.35 + 0.7, 0.7), 2.1);
      thrusterRaw.set(targetThruster);

      // Spawn subtle glowing thruster trail sparks (throttled to >40ms to keep main thread completely free)
      if (currentSpeed > 0.85 && now - lastParticleTime.current > 40) {
        lastParticleTime.current = now;
        const newParticle: TrailParticle = {
          id: particleIdCounter.current++,
          x: x + 10 - dx * 0.15,
          y: y + 22 - dy * 0.15,
          size: Math.random() * 2.2 + 1.4,
        };
        setParticles((prev) => [...prev.slice(-8), newParticle]);
      }

      prevPos.current = { x, y, time: now };

      // Optimized hit-testing: only run expensive .closest() check when the hovered target DOM node actually changes
      if (e.target !== lastTargetRef.current) {
        lastTargetRef.current = e.target;
        const target = e.target as HTMLElement | SVGElement | null;
        if (target && typeof target.closest === 'function') {
          const isInteractive = Boolean(
            target.closest(
              'button, a, input, textarea, select, [role="button"], .cursor-pointer, path.cursor-pointer, g.cursor-pointer, [data-interactive="true"], .node-element, .map-district'
            )
          );
          setIsHovering(isInteractive);
        } else {
          setIsHovering(false);
        }
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button === 0) {
        setIsClicking(true);
        thrusterRaw.set(2.4);

        // Emit expanding cyan radar shockwave at click coordinates
        const newShockwave: Shockwave = {
          id: shockwaveIdCounter.current++,
          x: e.clientX,
          y: e.clientY,
        };
        setShockwaves((prev) => [...prev.slice(-3), newShockwave]);
      }
    };

    const handlePointerUp = () => {
      setIsClicking(false);
      thrusterRaw.set(0.7);
    };

    const handlePointerLeave = () => {
      setIsVisible(false);
      lastTargetRef.current = null;
      setIsHovering(false);
    };

    const handlePointerEnter = () => {
      setIsVisible(true);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    document.documentElement.addEventListener('pointerleave', handlePointerLeave);
    document.documentElement.addEventListener('pointerenter', handlePointerEnter);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      document.documentElement.removeEventListener('pointerleave', handlePointerLeave);
      document.documentElement.removeEventListener('pointerenter', handlePointerEnter);
    };
  }, [isTouchDevice, isVisible, mouseX, mouseY, mouseTilt, thrusterRaw]);

  // Clean up faded shockwaves
  const removeShockwave = useCallback((id: number) => {
    setShockwaves((prev) => prev.filter((sw) => sw.id !== id));
  }, []);

  // Clean up particles
  useEffect(() => {
    if (particles.length === 0) return;
    const timeout = setTimeout(() => {
      setParticles((prev) => prev.slice(1));
    }, 240);
    return () => clearTimeout(timeout);
  }, [particles]);

  if (isTouchDevice || !isVisible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden select-none"
      style={{ willChange: 'transform' }}
    >
      {/* 1. EXPANDING RADAR SHOCKWAVES ON CLICK */}
      {shockwaves.map((sw) => (
        <motion.div
          key={sw.id}
          initial={{ scale: 0, opacity: 0.9 }}
          animate={{ scale: 1.25, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.42, ease: 'easeOut' }}
          onAnimationComplete={() => removeShockwave(sw.id)}
          className="absolute rounded-full border border-cyan-400 shadow-[0_0_14px_#00E5FF] pointer-events-none"
          style={{
            left: sw.x - 28,
            top: sw.y - 28,
            width: 56,
            height: 56,
            willChange: 'transform, opacity',
          }}
        />
      ))}

      {/* 2. FAINT FAST-FADING THRUSTER TRAIL PARTICLES */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0.75, scale: 1 }}
          animate={{ opacity: 0, scale: 0.2, y: 12 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="absolute rounded-full bg-cyan-400 shadow-[0_0_6px_#00E5FF] pointer-events-none"
          style={{
            left: p.x - p.size / 2,
            top: p.y - p.size / 2,
            width: p.size,
            height: p.size,
            willChange: 'transform, opacity',
          }}
        />
      ))}

      {/* 3. SECONDARY VISUAL AURA: RETICLE RING TRAILS SMOOTHLY WITH SPRING DYNAMICS */}
      <motion.div
        style={{
          x: reticleSpringX,
          y: reticleSpringY,
          willChange: 'transform',
        }}
        className="absolute top-0 left-0 pointer-events-none"
      >
        <AnimatePresence>
          {isHovering && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1, rotate: 360 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{
                opacity: { duration: 0.15 },
                scale: { duration: 0.2, ease: 'easeOut' },
                rotate: { duration: 6, repeat: Infinity, ease: 'linear' },
              }}
              className="absolute w-12 h-12 rounded-full border border-dashed border-cyan-400 shadow-[0_0_12px_rgba(0,229,255,0.45)] pointer-events-none"
              style={{
                left: -24,
                top: -24,
                transformOrigin: '24px 24px',
              }}
            >
              {/* 4 Corner Crosshair Reticle Brackets */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-0.5 bg-cyan-300 shadow-[0_0_4px_#00E5FF]" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-0.5 bg-cyan-300 shadow-[0_0_4px_#00E5FF]" />
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-1.5 bg-cyan-300 shadow-[0_0_4px_#00E5FF]" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-1.5 bg-cyan-300 shadow-[0_0_4px_#00E5FF]" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 4. MAIN TACTICAL POINTER ROOT CONTAINER - 1:1 HARDWARE SYNC (ZERO LAG) */}
      <motion.div
        style={{
          x: mouseX,
          y: mouseY,
          willChange: 'transform',
        }}
        className="absolute top-0 left-0 pointer-events-none"
      >
        {/* Tilting & Recoil Wrapper (Pivot anchored exactly at top-left tip [0, 0]) */}
        <motion.div
          style={{
            rotate: springTilt,
            transformOrigin: '0px 0px',
          }}
          animate={{
            scale: isClicking ? 0.85 : isHovering ? 1.15 : 1,
          }}
          transition={{
            type: 'spring',
            stiffness: 750,
            damping: 26,
          }}
          className="relative pointer-events-none"
        >
          {/* FUTURISTIC CYAN-OUTLINED THRUSTER ARROW POINTER (Top-left tip at [0, 0]) */}
          <svg
            width="32"
            height="36"
            viewBox="0 0 32 36"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="overflow-visible pointer-events-none"
            style={{
              filter: isHovering
                ? 'drop-shadow(0 0 8px #00E5FF) drop-shadow(0 0 16px rgba(0,229,255,0.5))'
                : 'drop-shadow(0 0 4px #00E5FF) drop-shadow(0 2px 5px rgba(0,0,0,0.8))',
            }}
          >
            <defs>
              {/* Dark Metallic Core Gradient */}
              <linearGradient id="tactical_core_metal" x1="0" y1="0" x2="22" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#121D27" />
                <stop offset="50%" stopColor="#0A1118" />
                <stop offset="100%" stopColor="#04080D" />
              </linearGradient>

              {/* Glowing Electric Cyan Border Gradient */}
              <linearGradient id="tactical_cyan_edge" x1="0" y1="0" x2="20" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="35%" stopColor="#00E5FF" />
                <stop offset="100%" stopColor="#00B4D8" />
              </linearGradient>

              {/* Rear Plasma Thruster Flame Gradient */}
              <linearGradient id="thruster_plasma_flame" x1="10" y1="21" x2="10" y2="33" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="25%" stopColor="#00E5FF" stopOpacity="0.95" />
                <stop offset="70%" stopColor="#0891B2" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
              </linearGradient>

              {/* Thruster Glow Filter */}
              <filter id="thruster_glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="1.8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* REAR THRUSTER NOZZLE FLAME (Originating at [10, 21]) */}
            <g transform="translate(10, 21)">
              <motion.g
                style={{
                  transformOrigin: '0px 0px',
                  scaleY: springThruster,
                  scaleX: springThrusterWidth,
                }}
                filter="url(#thruster_glow)"
              >
                {/* Outer Cyan Plasma Jet */}
                <polygon
                  points="-3.5,0 3.5,0 1.5,9.5 0,13 -1.5,9.5"
                  fill="url(#thruster_plasma_flame)"
                  className="animate-pulse"
                  style={{ animationDuration: '0.4s' }}
                />

                {/* Inner White Hot Core */}
                <polygon
                  points="-1.5,0 1.5,0 0.8,5 0,7 -0.8,5"
                  fill="#FFFFFF"
                  opacity="0.95"
                />
              </motion.g>
            </g>

            {/* MAIN AERODYNAMIC DART ARROW (Hotspot Tip anchored at [1, 1]) */}
            {/* Outline & Core */}
            <path
              d="M 1 1 L 1 23 L 6.5 17.5 L 9 21.5 L 12 21.5 L 10 16 L 19 19 Z"
              fill="url(#tactical_core_metal)"
              stroke="url(#tactical_cyan_edge)"
              strokeWidth="1.6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* INNER GEOMETRIC CHEVRON CUTOUT */}
            <path
              d="M 3.8 6.5 L 3.8 14.5 L 7.5 11 L 12.5 13.5 Z"
              fill="#06090E"
              stroke="#00E5FF"
              strokeWidth="0.8"
              strokeOpacity="0.75"
              strokeLinejoin="round"
            />

            {/* Tactical Detail Accent Lines */}
            <line
              x1="1"
              y1="1"
              x2="7.5"
              y2="11"
              stroke="#00E5FF"
              strokeWidth="0.6"
              strokeOpacity="0.6"
            />

            {/* Rear Thruster Ring Nozzle Cap */}
            <rect
              x="8.2"
              y="20.5"
              width="4.6"
              height="1.5"
              rx="0.5"
              fill="#0E1720"
              stroke="#00E5FF"
              strokeWidth="0.7"
            />

            {/* Ultra-sharp razor tip highlight dot at [1, 1] */}
            <circle cx="1.2" cy="1.2" r="0.9" fill="#FFFFFF" />
          </svg>
        </motion.div>
      </motion.div>
    </div>
  );
};
