import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { useLibrary, useNotifications } from './hooks';
import { useRouteData } from './hooks/useRouteData';
import { AppHeader, NotificationToast, EmptyLibraryState, AppFooter, SplashScreen, AboutModal, SkeletonCard } from './components/ui';
import { Sidebar } from './components/Sidebar';
import DuplicateDetector from './components/DuplicateDetector';
import { TrackRelocator } from './components/TrackRelocator';
import type { TabType } from './types';

const pathToTab: Record<string, TabType> = {
  '/': 'duplicates',
  '/relocate': 'relocate',
  '/import': 'import',
  '/maintenance': 'maintenance',
};

const AppWithRouter: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [showAbout, setShowAbout] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Derive active tab from route
  const activeTab = pathToTab[location.pathname] || 'duplicates';
  
  // Custom hooks
  const { notification, showNotification } = useNotifications();
  const { 
    libraryPath, 
    libraryData, 
    isLoading, 
    selectLibrary, 
    setLibraryData 
  } = useLibrary(showNotification);
  
  // Fetch route-specific cached data from Dexie
  const { 
    isLoading: isLoadingCached, 
    duplicateResults, 
    relocationResults,
    settings 
  } = useRouteData(location.pathname, libraryPath);

  // Hide splash screen after initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Set up menu event listeners
  useEffect(() => {
    const removeAboutListener = window.electronAPI.onShowAbout(() => {
      setShowAbout(true);
    });

    return () => {
      removeAboutListener();
    };
  }, []);

  // Show splash screen during initial load
  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <div className="h-screen bg-rekordbox-dark flex overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab}
        libraryData={libraryData}
        libraryPath={libraryPath}
        isLoading={isLoading}
        onSelectLibrary={selectLibrary}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <AppHeader
          libraryPath={libraryPath}
          isLoading={isLoading}
          onSelectLibrary={selectLibrary}
        />

        {/* Notification */}
        {notification && <NotificationToast notification={notification} />}

        {/* Content with route-based animation */}
        <div className="flex-1 p-6 overflow-hidden">
        {!libraryData ? (
          <EmptyLibraryState onSelectLibrary={selectLibrary} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15, ease: 'easeInOut' }}
              className="h-full"
            >
              {activeTab === 'duplicates' && (
                <div className="h-full flex flex-col">
                  {isLoadingCached ? (
                    <SkeletonCard />
                  ) : (
                    <DuplicateDetector
                      libraryData={libraryData}
                      libraryPath={libraryPath}
                      onUpdate={(updatedLibrary) => setLibraryData(updatedLibrary)}
                      showNotification={showNotification}
                      initialCachedData={duplicateResults}
                    />
                  )}
                </div>
              )}

              {activeTab === 'relocate' && (
                <div className="h-full flex flex-col">
                  {isLoadingCached ? (
                    <SkeletonCard />
                  ) : (
                    <TrackRelocator
                      libraryData={libraryData}
                      showNotification={showNotification}
                      initialCachedData={relocationResults}
                    />
                  )}
                </div>
              )}

              {activeTab === 'import' && (
                <div className="card">
                  <h2 className="text-xl font-bold mb-4">Auto Import</h2>
                  <p className="text-zinc-400">
                    Feature coming soon: Automatically import new tracks while preventing duplicates
                  </p>
                </div>
              )}

              {activeTab === 'maintenance' && (
                <div className="card">
                  <h2 className="text-xl font-bold mb-4">Library Maintenance</h2>
                  <p className="text-zinc-400">
                    Feature coming soon: Find orphan tracks, repair files, and optimize your library
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
        </div>

        {/* Footer */}
        <AppFooter libraryData={libraryData} />
      </div>

      {/* About Modal */}
      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />
    </div>
  );
};

export default AppWithRouter;