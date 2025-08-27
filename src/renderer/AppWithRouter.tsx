import React, { useState, useEffect } from 'react';
import { useLocation } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Wrench } from 'lucide-react';
import { useLibrary, useNotifications } from './hooks';
import { useRouteData } from './hooks/useRouteData';
import { NotificationToast, EmptyLibraryState, AppFooter, SplashScreen, AboutModal, SkeletonCard, NativeDropHandler } from './components/ui';
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
    loadLibrary,
    clearStoredData,
    setLibraryData 
  } = useLibrary(showNotification);
  
  // Fetch route-specific cached data from Dexie
  const { 
    isLoading: isLoadingCached 
    // duplicateResults, relocationResults, settings // Unused for now
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
    if (window.electronAPI?.onShowAbout) {
      const removeAboutListener = window.electronAPI.onShowAbout(() => {
        setShowAbout(true);
      });

      return () => {
        removeAboutListener();
      };
    }
  }, []);

  // Show splash screen during initial load
  if (showSplash) {
    return <SplashScreen />;
  }

  return (
    <div className="h-screen bg-rekordbox-dark flex flex-col overflow-hidden">
      {/* Title Bar for Window Controls */}
      <div className="h-7 bg-gray-800 app-drag-region flex-shrink-0"></div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab}
        libraryData={libraryData}
        libraryPath={libraryPath}
        isLoading={isLoading}
        onSelectLibrary={selectLibrary}
        onUnloadLibrary={clearStoredData}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Notification */}
        {notification && <NotificationToast notification={notification} />}

        {/* Content with route-based animation */}
        <div className="flex-1 py-4 overflow-hidden">
        {!libraryData ? (
          <EmptyLibraryState onSelectLibrary={selectLibrary} onLoadLibrary={loadLibrary} />
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
                    />
                  )}
                </div>
              )}

              {activeTab === 'import' && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center max-w-lg">
                    <div className="bg-gray-800 rounded-2xl p-8">
                      <div className="w-12 h-12 bg-rekordbox-purple/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <Download className="w-6 h-6 text-rekordbox-purple" />
                      </div>
                      <h2 className="text-xl font-bold text-white mb-3">Auto Import</h2>
                      <p className="text-zinc-400 leading-relaxed">
                        Feature coming soon: Automatically import new tracks while preventing duplicates
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'maintenance' && (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center max-w-lg">
                    <div className="bg-gray-800 rounded-2xl p-8">
                      <div className="w-12 h-12 bg-rekordbox-purple/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <Wrench className="w-6 h-6 text-rekordbox-purple" />
                      </div>
                      <h2 className="text-xl font-bold text-white mb-3">Library Maintenance</h2>
                      <p className="text-zinc-400 leading-relaxed">
                        Feature coming soon: Find orphan tracks, repair files, and optimize your library
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
        </div>

        {/* Footer */}
        <AppFooter libraryData={libraryData} />
      </div>
      </div>

      {/* About Modal */}
      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />
      
      {/* Native Drop Handler */}
      <NativeDropHandler onFileDrop={loadLibrary} acceptedExtensions={['.xml']} />
    </div>
  );
};

export default AppWithRouter;