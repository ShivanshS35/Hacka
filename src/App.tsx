import React, { useEffect, useState } from 'react';
import { prahariApi } from './services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Preloader } from './components/Preloader';
import { EditorialShowcase } from './components/EditorialShowcase';
import { WarMonitorLiveApp } from './components/WarMonitorLiveApp';
import { TacticalCursor } from './components/TacticalCursor';

export function App() {
  const [hasLoaded, setHasLoaded] = useState(false);

  // Wake a sleeping free-tier backend during the preloader so the first real request is fast.
  useEffect(() => {
    prahariApi.checkHealth();
  }, []);
  // Default to EDITORIAL so the user lands on the product showcase first!
  const [currentView, setCurrentView] = useState<'EDITORIAL' | 'COMMAND'>('EDITORIAL');

  return (
    <div className="min-h-screen bg-[#070A10] text-white overflow-x-hidden font-sans">
      {/* Custom Tactical Cyan-Outlined Thruster Arrow Cursor */}
      <TacticalCursor />

      {/* 1. Melon Studio Signature Preloader Animation (~4s with system status & skip) */}
      {!hasLoaded && (
        <Preloader onComplete={() => setHasLoaded(true)} />
      )}

      {/* 2. Main Application Experience with Smooth Page Transitions */}
      {hasLoaded && (
        <AnimatePresence mode="wait">
          {currentView === 'EDITORIAL' ? (
            <motion.div
              key="editorial-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -20, transition: { duration: 0.3 } }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              <EditorialShowcase
                onLaunchCommand={() => setCurrentView('COMMAND')}
                onExploreGraph={() => setCurrentView('COMMAND')}
              />
            </motion.div>
          ) : (
            <motion.div
              key="command-view"
              initial={{ opacity: 0, scale: 1.01 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: 20, transition: { duration: 0.3 } }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="h-screen w-screen overflow-hidden"
            >
              <WarMonitorLiveApp
                onOpenEditorial={() => setCurrentView('EDITORIAL')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

export default App;
