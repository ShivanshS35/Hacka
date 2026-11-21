import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Preloader } from './components/Preloader';
import { EditorialShowcase } from './components/EditorialShowcase';
import { CommandCenter } from './components/CommandCenter';

export function App() {
  const [hasLoaded, setHasLoaded] = useState(false);
  // Default to EDITORIAL so the user lands on the product showcase first!
  const [currentView, setCurrentView] = useState<'EDITORIAL' | 'COMMAND'>('EDITORIAL');

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      {/* 1. Melon Studio Signature Preloader Animation */}
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
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: 20, transition: { duration: 0.3 } }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="h-screen w-screen overflow-hidden"
            >
              <CommandCenter
                onReturnToEditorial={() => setCurrentView('EDITORIAL')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

export default App;
