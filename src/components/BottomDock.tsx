import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Bell,
  FolderSearch,
  House,
  KeyRound,
  LayoutDashboard,
  Network,
  Newspaper,
  Settings,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { PixelDissolve } from './PixelDissolve';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

export type DockKey = 'dashboard' | 'alerts' | 'network' | 'evidence' | 'team' | 'settings';
export type DockSubKey = 'command' | 'editorial' | 'ai-settings' | 'import';

interface DockMenuItem {
  key: DockSubKey;
  label: string;
  icon: LucideIcon;
}

interface DockItem {
  key: DockKey;
  label: string;
  icon: LucideIcon;
  menu?: DockMenuItem[];
}

export const DOCK_ITEMS: DockItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: House,
    menu: [
      { key: 'command', label: 'Command Center', icon: LayoutDashboard },
      { key: 'editorial', label: 'Landing page', icon: Newspaper },
    ],
  },
  { key: 'alerts', label: 'Alerts', icon: Bell },
  { key: 'network', label: 'Network graph', icon: Network },
  { key: 'evidence', label: 'Evidence dossier', icon: FolderSearch },
  { key: 'team', label: 'Team', icon: Users },
  {
    key: 'settings',
    label: 'Settings',
    icon: Settings,
    menu: [
      { key: 'ai-settings', label: 'AI settings (Gemini key)', icon: KeyRound },
      { key: 'import', label: 'Import intel', icon: Upload },
    ],
  },
];

interface BottomDockProps {
  activeKey: DockKey | null;
  onSelect: (key: DockKey, sub?: DockSubKey) => void;
}

const CLOSE_DELAY_MS = 150;

export const BottomDock: React.FC<BottomDockProps> = ({ activeKey, onSelect }) => {
  const reduced = usePrefersReducedMotion();
  const listRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const closeTimer = useRef<number | undefined>(undefined);
  const [openMenu, setOpenMenu] = useState<DockKey | null>(null);
  const [focusMenuOnOpen, setFocusMenuOnOpen] = useState(false);
  const [highlight, setHighlight] = useState<{ x: number; w: number } | null>(null);

  // ---- sliding highlight behind the active item
  const measure = useCallback(() => {
    const btn = activeKey ? buttonRefs.current[activeKey] : null;
    setHighlight(btn ? { x: btn.offsetLeft, w: btn.offsetWidth } : null);
  }, [activeKey]);
  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  // ---- popup open / close
  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpenMenu(null), CLOSE_DELAY_MS);
  };
  useEffect(() => () => cancelClose(), []);

  const closeMenu = (returnFocusTo?: DockKey) => {
    cancelClose();
    setOpenMenu(null);
    if (returnFocusTo) buttonRefs.current[returnFocusTo]?.focus();
  };

  // Close on outside click / tap.
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: PointerEvent) => {
      if (!listRef.current?.parentElement?.contains(e.target as Node)) closeMenu();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [openMenu]);

  // Move focus into the menu when it was opened from the keyboard.
  useEffect(() => {
    if (!openMenu || !focusMenuOnOpen) return;
    const first = menuRefs.current[openMenu]?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    first?.focus();
    setFocusMenuOnOpen(false);
  }, [openMenu, focusMenuOnOpen]);

  const onItemClick = (item: DockItem, e: React.MouseEvent) => {
    if (item.menu) {
      // detail === 0 means the click came from the keyboard (Enter / Space).
      const opening = openMenu !== item.key;
      cancelClose();
      setOpenMenu(opening ? item.key : null);
      setFocusMenuOnOpen(opening && e.detail === 0);
      return;
    }
    closeMenu();
    onSelect(item.key);
  };

  const onDockKeyDown = (e: React.KeyboardEvent) => {
    const keys = DOCK_ITEMS.map((i) => i.key);
    const current = keys.findIndex((k) => buttonRefs.current[k] === document.activeElement);
    if (e.key === 'Escape' && openMenu) {
      e.preventDefault();
      closeMenu(openMenu);
      return;
    }
    if (current < 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = (current + (e.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length;
      buttonRefs.current[keys[next]]?.focus();
    } else if (e.key === 'ArrowUp' && DOCK_ITEMS[current].menu) {
      e.preventDefault();
      setOpenMenu(DOCK_ITEMS[current].key);
      setFocusMenuOnOpen(true);
    }
  };

  const onMenuKeyDown = (item: DockItem) => (e: React.KeyboardEvent) => {
    const entries = Array.from(
      menuRefs.current[item.key]?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []
    );
    const i = entries.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = entries.length;
      entries[(i + (e.key === 'ArrowDown' ? 1 : n - 1) + n) % n]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeMenu(item.key);
    } else if (e.key === 'Tab') {
      closeMenu();
    }
  };

  return (
    <div
      className="fixed inset-x-0 z-40 flex justify-center pointer-events-none px-3"
      style={{ bottom: 'max(20px, env(safe-area-inset-bottom))' }}
    >
      <nav aria-label="Main navigation" className="pointer-events-auto relative" onKeyDown={onDockKeyDown}>
        <div
          ref={listRef}
          className="relative flex items-center gap-0.5 sm:gap-1 rounded-full p-1.5 sm:p-2 bg-[#0A101B]/70 backdrop-blur-[16px] border border-white/[0.12] shadow-[0_10px_40px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]"
        >
          {/* Sliding highlight */}
          <span
            aria-hidden="true"
            className="absolute top-1.5 bottom-1.5 sm:top-2 sm:bottom-2 left-0 rounded-full bg-white/[0.12] border border-cyan-300/25 shadow-[0_0_18px_rgba(0,229,255,0.22),inset_0_1px_0_rgba(255,255,255,0.1)]"
            style={{
              width: highlight?.w ?? 0,
              transform: `translateX(${highlight?.x ?? 0}px)`,
              opacity: highlight ? 1 : 0,
              transition: reduced ? 'opacity 150ms ease' : 'transform 250ms ease, width 250ms ease, opacity 200ms ease',
            }}
          />

          {DOCK_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeKey === item.key;
            const isOpen = openMenu === item.key;
            const alignRight = index >= DOCK_ITEMS.length / 2;
            return (
              <div
                key={item.key}
                className="relative"
                onPointerEnter={(e) => {
                  if (e.pointerType !== 'mouse') return;
                  cancelClose();
                  if (item.menu) setOpenMenu(item.key);
                  else if (openMenu) scheduleClose();
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === 'mouse' && openMenu === item.key) scheduleClose();
                }}
              >
                <button
                  ref={(el) => (buttonRefs.current[item.key] = el)}
                  type="button"
                  onClick={(e) => onItemClick(item, e)}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  aria-haspopup={item.menu ? 'menu' : undefined}
                  aria-expanded={item.menu ? isOpen : undefined}
                  aria-controls={item.menu ? `dock-menu-${item.key}` : undefined}
                  className={`group relative z-10 flex items-center justify-center w-12 h-11 sm:w-14 sm:h-12 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 transition-colors ${
                    isActive ? 'text-white' : 'text-slate-400 hover:text-slate-100 focus-visible:text-slate-100'
                  }`}
                >
                  <Icon
                    aria-hidden="true"
                    className={`w-6 h-6 motion-safe:transition-transform motion-safe:duration-200 ${
                      isActive ? '' : 'motion-safe:group-hover:scale-[1.08]'
                    }`}
                    strokeWidth={isActive ? 2.25 : 1.75}
                    fill={isActive ? 'currentColor' : 'none'}
                    fillOpacity={isActive ? 0.22 : 0}
                  />
                  {/* Tooltip (mouse hover or keyboard focus; hidden while the item's menu is open) */}
                  {!isOpen && (
                    <span
                      role="presentation"
                      className="pointer-events-none absolute bottom-full mb-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#0A101B]/90 px-2 py-1 font-mono text-[10px] tracking-wide text-slate-200 opacity-0 shadow-lg transition-opacity duration-150 [@media(hover:hover)]:group-hover:opacity-100 group-focus-visible:opacity-100"
                    >
                      {item.label}
                    </span>
                  )}
                </button>

                {item.menu && (
                  <PixelDissolve
                    open={isOpen}
                    id={`dock-menu-${item.key}`}
                    role="menu"
                    aria-label={`${item.label} menu`}
                    className={`absolute bottom-full mb-3 ${alignRight ? 'right-0' : 'left-0'} min-w-[210px]`}
                  >
                    <div
                      ref={(el) => (menuRefs.current[item.key] = el)}
                      onKeyDown={onMenuKeyDown(item)}
                      className="rounded-2xl p-1.5 bg-[#0A101B]/80 backdrop-blur-[16px] border border-white/[0.12] shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
                    >
                      <div className="px-3 pt-1.5 pb-1 font-mono text-[9px] tracking-[0.2em] text-cyan-300/70 uppercase">
                        {item.label}
                      </div>
                      {item.menu.map((sub) => {
                        const SubIcon = sub.icon;
                        return (
                          <button
                            key={sub.key}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              closeMenu();
                              onSelect(item.key, sub.key);
                            }}
                            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] text-slate-200 outline-none hover:bg-white/[0.08] focus-visible:bg-white/[0.08] focus-visible:ring-1 focus-visible:ring-cyan-300/60"
                          >
                            <SubIcon aria-hidden="true" className="w-4 h-4 text-cyan-300/80" />
                            <span>{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </PixelDissolve>
                )}
              </div>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
