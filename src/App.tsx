import React, { useCallback, useEffect, useState } from 'react';
import { prahariApi } from './services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Preloader } from './components/Preloader';
import { EditorialShowcase } from './components/EditorialShowcase';
import { WarMonitorLiveApp, type WarMonitorNavTab } from './components/WarMonitorLiveApp';
import { TacticalCursor } from './components/TacticalCursor';
import { AccessTokenGate } from './components/AccessTokenGate';
import { BottomDock, type DockKey, type DockSubKey } from './components/BottomDock';
import { TeamPage } from './components/TeamPage';
import { SettingsDialog } from './components/SettingsDialog';
import { syncPath, viewFromPath, type AppView } from './utils/route';

const TAB_FOR_DOCK: Partial<Record<DockKey, WarMonitorNavTab>> = {
  alerts: 'ALERTS',
  network: 'TOPOLOGY',
  evidence: 'DOSSIER',
};
const DOCK_FOR_TAB: Record<WarMonitorNavTab, DockKey> = {
  COMMAND: 'dashboard',
  ALERTS: 'alerts',
  TOPOLOGY: 'network',
  DOSSIER: 'evidence',
};

export function App() {
  const [hasLoaded, setHasLoaded] = useState(false);

  // Wake a sleeping free-tier backend during the preloader so the first real request is fast.
  useEffect(() => {
    prahariApi.checkHealth();
  }, []);
  // Default to EDITORIAL so the user lands on the product showcase first (or /team if that was opened).
  const [currentView, setCurrentView] = useState<AppView>(() => viewFromPath() ?? 'EDITORIAL');
  const [navTab, setNavTab] = useState<WarMonitorNavTab>('COMMAND');
  const [importRequestId, setImportRequestId] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const goTo = useCallback((view: AppView) => {
    setCurrentView(view);
    syncPath(view);
    if (view !== 'COMMAND') window.scrollTo({ top: 0 });
  }, []);

  // Browser Back / Forward between "/" and "/team".
  useEffect(() => {
    const onPop = () => setCurrentView((prev) => viewFromPath() ?? (prev === 'TEAM' ? 'COMMAND' : prev));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const onDockSelect = (key: DockKey, sub?: DockSubKey) => {
    if (key === 'team') return goTo('TEAM');
    if (key === 'settings') {
      if (sub === 'ai-settings') setSettingsOpen(true);
      if (sub === 'import') {
        goTo('COMMAND');
        setImportRequestId((n) => n + 1);
      }
      return;
    }
    if (key === 'dashboard') {
      if (sub === 'editorial') return goTo('EDITORIAL');
      setNavTab('COMMAND');
      return goTo('COMMAND');
    }
    const tab = TAB_FOR_DOCK[key];
    if (tab) {
      setNavTab(tab);
      goTo('COMMAND');
    }
  };

  const activeDock: DockKey | null =
    currentView === 'TEAM' ? 'team' : currentView === 'COMMAND' ? DOCK_FOR_TAB[navTab] : 'dashboard';

  return (
    <div className="min-h-screen bg-[#070A10] text-white overflow-x-hidden font-sans">
      {/* Custom Tactical Cyan-Outlined Thruster Arrow Cursor */}
      <TacticalCursor />

      {/* Asks for the backend access token when none is saved or the backend rejects it */}
      <AccessTokenGate />

      {/* 1. Melon Studio Signature Preloader Animation (~4s with system status & skip) */}
      {!hasLoaded && (
        <Preloader onComplete={() => setHasLoaded(true)} />
      )}

      {/* 2. Main Application Experience with Smooth Page Transitions */}
      {hasLoaded && (
        <AnimatePresence mode="wait">
          {currentView === 'EDITORIAL' && (
            <motion.div
              key="editorial-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -20, transition: { duration: 0.3 } }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="pb-[var(--dock-clearance)]"
            >
              <EditorialShowcase
                onLaunchCommand={() => goTo('COMMAND')}
                onExploreGraph={() => goTo('COMMAND')}
              />
            </motion.div>
          )}
          {currentView === 'COMMAND' && (
            <motion.div
              key="command-view"
              initial={{ opacity: 0, scale: 1.01 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: 20, transition: { duration: 0.3 } }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="h-screen w-screen overflow-hidden"
            >
              <WarMonitorLiveApp
                onOpenEditorial={() => goTo('EDITORIAL')}
                navTab={navTab}
                onNavTabChange={setNavTab}
                importRequestId={importRequestId}
              />
            </motion.div>
          )}
          {currentView === 'TEAM' && (
            <motion.div
              key="team-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <TeamPage />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {hasLoaded && <BottomDock activeKey={activeDock} onSelect={onDockSelect} />}
      <SettingsDialog open={settingsOpen} onClose={closeSettings} />
    </div>
  );
}

export default App;
