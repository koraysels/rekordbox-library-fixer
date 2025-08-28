import React, { useState, useEffect, createContext, useContext } from 'react';
import { useLocation, Outlet } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { useLibrary, useNotifications } from './hooks';
import { useRouteData } from './hooks/useRouteData';
import { NotificationToast, EmptyLibraryState, AppFooter, SplashScreen, AboutModal, SkeletonCard, NativeDropHandler } from './components/ui';
import { Sidebar } from './components/Sidebar';
import type { TabType, LibraryData, NotificationType } from './types';

// Context for route components to access app-wide data
interface AppContextType {
  libraryData: LibraryData | null;
  libraryPath: string;
  showNotification: (type: NotificationType, message: string) => void;
  setLibraryData: (data: LibraryData) => void;
}

export const AppContext = createContext<AppContextType | null>(null);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppContextProvider');
  }
  return context;
};

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

        {/* Content with route-based rendering */}
        <div className="flex-1 py-4 overflow-hidden">
        {!libraryData ? (
          <EmptyLibraryState onSelectLibrary={selectLibrary} onLoadLibrary={loadLibrary} />
        ) : (
          <AppContext.Provider value={{
            libraryData,
            libraryPath,
            showNotification,
            setLibraryData
          }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                className="h-full"
              >
                <div className="h-full flex flex-col">
                  {isLoadingCached ? (
                    <SkeletonCard />
                  ) : (
                    <Outlet />
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </AppContext.Provider>
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