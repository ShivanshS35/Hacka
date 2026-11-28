import React, { useLayoutEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

interface PixelDissolveProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean;
  /** Square size in px. */
  cell?: number;
  /** Open / close duration in ms. */
  duration?: number;
  children: React.ReactNode;
}

function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Reveals or hides its content as a grid of small squares in random order (a "pixel dissolve").
 * It uses one CSS clip-path made of square sub-paths, updated per animation frame: no extra library
 * and no extra DOM nodes. With prefers-reduced-motion it falls back to a plain fade.
 */
export const PixelDissolve: React.FC<PixelDissolveProps> = ({
  open,
  cell = 12,
  duration = 300,
  children,
  style,
  ...rest
}) => {
  const reduced = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(open);
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  // Mount in the same render that opens, so focus can move into the content right away.
  if (open && !mounted) setMounted(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !mounted) return;
    cancelAnimationFrame(raf.current);

    if (reduced) {
      el.style.clipPath = 'none';
      el.style.transition = 'opacity 150ms ease';
      if (open) {
        el.style.opacity = '0';
        raf.current = requestAnimationFrame(() => (el.style.opacity = '1'));
        return () => cancelAnimationFrame(raf.current);
      }
      el.style.opacity = '0';
      const t = window.setTimeout(() => setMounted(false), 150);
      return () => window.clearTimeout(t);
    }

    el.style.transition = 'none';
    el.style.opacity = '1';
    const { width, height } = el.getBoundingClientRect();
    const cols = Math.max(1, Math.ceil(width / cell));
    const rows = Math.max(1, Math.ceil(height / cell));
    const order = shuffled(cols * rows);
    const start = performance.now();
    const EMPTY = "path('M0 0')";

    const frame = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const shown = Math.round((open ? p : 1 - p) * order.length);
      if (open && p >= 1) {
        el.style.clipPath = 'none';
        return;
      }
      if (!open && p >= 1) {
        el.style.clipPath = EMPTY;
        setMounted(false);
        return;
      }
      let d = '';
      for (let i = 0; i < shown; i++) {
        const c = order[i];
        d += `M${(c % cols) * cell} ${Math.floor(c / cols) * cell}h${cell}v${cell}h-${cell}z`;
      }
      el.style.clipPath = shown ? `path('${d}')` : EMPTY;
      raf.current = requestAnimationFrame(frame);
    };
    el.style.clipPath = open ? EMPTY : 'none';
    raf.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf.current);
  }, [open, mounted, reduced, cell, duration]);

  if (!mounted) return null;
  return (
    <div ref={ref} style={style} {...rest}>
      {children}
    </div>
  );
};
