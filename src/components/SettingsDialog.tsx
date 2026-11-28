import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ApiKeyConfig } from './ApiKeyConfig';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Small glass dialog that hosts the existing AI settings (Gemini key) panel. */
export const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      (panelRef.current?.querySelector<HTMLElement>('#gemini-key') ?? panelRef.current)?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Tab' && panelRef.current) {
        // keep focus inside the dialog
        const f = panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, [tabindex="0"]');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      returnFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#0A101B]/90 backdrop-blur-[16px] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.6)] outline-none"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 id="settings-dialog-title" className="font-mono text-xs tracking-[0.2em] text-cyan-300 uppercase">
            Settings · AI second opinion
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <p className="text-[12px] text-slate-400 leading-relaxed">
          Optional. With a Gemini key, posts the rules are unsure about get a second opinion. Without one, Prahari uses
          the rules only.
        </p>
        <ApiKeyConfig defaultOpen />
      </div>
    </div>
  );
};
