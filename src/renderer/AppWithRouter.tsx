import React, { useState, useEffect, createContext, useContext } from 'react';
import { useLocation, Outlet, useNavigate } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { useLibrary, useNotifications } from './hooks';
import { useRouteData } from './hooks/useRouteData';
import { NotificationToast, AppFooter, SplashScreen, AboutModal, TutorialModal, SkeletonCard, NativeDropHandler, MiniPlayer } from './components/ui';
import { Library } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import type { TabType, LibraryData, NotificationType } from './types';

// Context for route components to access app-wide data
interface AppContextType {
  libraryData: LibraryData | null;
  libraryPath: string;
  showNotification: (type: NotificationType, message: string) => void;
  setLibraryData: (data: LibraryData) => void;
  /** Open a library file by path, e.g. after restoring a backup. */
  onLoadLibrary?: (path: string) => void;
  onSelectLibrary?: () => void;
  onLoadFromDb?: () => void;
  onUnloadLibrary?: () => void;
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
  '/statistics': 'statistics',
  '/library': 'library',
  '/history': 'history',
  '/backups': 'backups',
};

const AppWithRouter: React.FC = () => {
  const [showAbout, setShowAbout] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Derive active tab from route
  const routeTab = pathToTab[location.pathname] || 'duplicates';

  // Backups are wanted exactly when something went wrong and nothing is
  // loaded, so this page must not sit behind the load screen.
  const worksWithoutLibrary = ['/backups', '/history', '/library'].includes(location.pathname);


  // Custom hooks
  const { notification, showNotification } = useNotifications();
  const {
    libraryPath,
    libraryData,
    isLoading,
    startupComplete,
    selectLibrary,
    loadLibrary,
    loadFromDb,
    clearStoredData,
    setLibraryData
  } = useLibrary(showNotification);

// Choosing a library is an app-level step, not part of duplicate detection.
  // Highlighting that tab behind the load screen suggested otherwise.
  const showingLoadScreen = !libraryData && !worksWithoutLibrary;

  // Fetch route-specific cached data from Dexie
  const {
    isLoading: isLoadingCached
    // duplicateResults, relocationResults, settings // Unused for now
  } = useRouteData(location.pathname, libraryPath);


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

  // Set up tutorial menu event listener
  useEffect(() => {
    if (window.electronAPI?.onShowTutorial) {
      const removeTutorialListener = window.electronAPI.onShowTutorial(() => {
        setShowTutorial(true);
      });

      return () => {
        removeTutorialListener();
      };
    }
  }, []);

  if (!startupComplete) {
    return <SplashScreen />;
  }

  return (
    <div className="h-screen bg-te-grey-100 flex flex-col overflow-hidden font-te-sans">
      {/* Title Bar for Window Controls */}
      <div className="h-10 bg-te-grey-700 app-drag-region flex-shrink-0"></div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Navigation */}
      <Sidebar
        activeTab={showingLoadScreen ? null : routeTab}
        libraryData={libraryData}
        libraryPath={libraryPath}
        isLoading={isLoading}
        onSelectLibrary={selectLibrary}
        onUnloadLibrary={clearStoredData}
        onShowTutorial={() => setShowTutorial(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Notification */}
        {notification && <NotificationToast notification={notification} />}

        {/* Content with route-based rendering */}
        <div className="flex-1 pt-3 pb-6 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-te-grey-500">
            <div className="w-10 h-10 border-4 border-te-grey-300 border-t-te-orange rounded-full animate-spin" />
            <p className="text-sm font-te-mono">Parsing library…</p>
          </div>
        ) : !libraryData && !worksWithoutLibrary ? (
          // Every feature page needs a library; point at the one place that
          // opens one instead of repeating the picker behind each tab.
          <div className="h-full flex items-center justify-center">
            <div className="text-center te-value max-w-sm px-6">
              <Library size={44} className="mx-auto mb-3 text-te-grey-400" />
              <h3 className="te-title mb-2">No library open</h3>
              <p className="te-label normal-case mb-4">
                Open one from the Library tab, then come back here.
              </p>
              <button onClick={() => navigate({ to: '/library' })} className="btn-primary text-xs">
                Go to Library
              </button>
            </div>
          </div>
        ) : (
          <AppContext.Provider value={{
            libraryData: libraryData as LibraryData,
            libraryPath,
            showNotification,
            setLibraryData,
            onLoadLibrary: loadLibrary,
            onSelectLibrary: selectLibrary,
            onLoadFromDb: loadFromDb,
            onUnloadLibrary: clearStoredData
          }}>
            {/* No mode="wait": the outgoing page's exit would otherwise have to
                finish before the new one starts, doubling the perceived delay. */}
            {libraryPath.toLowerCase().endsWith('.db') && (
              <div className="flex-shrink-0 mx-4 mb-2 px-3 py-2 rounded-te border border-te-amber-200 bg-te-amber-100">
                <p className="text-xs font-te-mono text-te-amber-600 normal-case">
                  Working on rekordbox&apos;s own database. Resolving duplicates edits it
                  directly, with rekordbox closed and a backup taken first. Track relocation
                  cannot write here yet — load an XML library for that.
                </p>
              </div>
            )}
            <AnimatePresence initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.09, ease: 'easeOut' }}
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

        {/* Mini player */}
        <MiniPlayer showNotification={showNotification} />

        {/* Footer */}
        <AppFooter libraryData={libraryData} />
      </div>
      </div>

      {/* About Modal */}
      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />

      {/* Tutorial Modal */}
      <TutorialModal isOpen={showTutorial} onClose={() => setShowTutorial(false)} />

      {/* Native Drop Handler */}
      <NativeDropHandler onFileDrop={loadLibrary} acceptedExtensions={['.xml']} />
    </div>
  );
};

export default AppWithRouter;
