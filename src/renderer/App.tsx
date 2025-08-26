import React, { useState } from 'react';
import { useLibrary, useNotifications } from './hooks';
import { AppHeader, NotificationToast, NavigationTabs, EmptyLibraryState, AppFooter } from './components/ui';
import DuplicateDetector from './components/DuplicateDetector';
import type { TabType } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('duplicates');
  
  // Custom hooks
  const { notification, showNotification } = useNotifications();
  const { 
    libraryPath, 
    libraryData, 
    isLoading, 
    selectLibrary, 
    setLibraryData 
  } = useLibrary(showNotification);


  return (
    <div className="h-screen bg-rekordbox-dark flex flex-col overflow-hidden">
      {/* Header */}
      <AppHeader
        libraryPath={libraryPath}
        isLoading={isLoading}
        onSelectLibrary={selectLibrary}
      />

      {/* Notification */}
      {notification && <NotificationToast notification={notification} />}

      {/* Navigation Tabs */}
      <NavigationTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        libraryData={libraryData}
      />

      {/* Content */}
      <div className="flex-1 p-6 pb-20 overflow-hidden">
        {!libraryData ? (
          <EmptyLibraryState onSelectLibrary={selectLibrary} />
        ) : (
          <>
            {/* Keep DuplicateDetector always mounted to preserve state */}
            <div 
              className="h-full flex flex-col"
              style={{ display: activeTab === 'duplicates' ? 'flex' : 'none' }}
            >
              <DuplicateDetector
                libraryData={libraryData}
                libraryPath={libraryPath}
                onUpdate={(updatedLibrary) => setLibraryData(updatedLibrary)}
                showNotification={showNotification}
              />
            </div>

            {activeTab === 'import' && (
              <div className="card">
                <h2 className="text-xl font-bold mb-4">Auto Import</h2>
                <p className="text-zinc-400">
                  Feature coming soon: Automatically import new tracks while preventing duplicates
                </p>
              </div>
            )}

            {activeTab === 'relocate' && (
              <div className="card">
                <h2 className="text-xl font-bold mb-4">Track Relocation</h2>
                <p className="text-zinc-400">
                  Feature coming soon: Fix missing tracks and relocate audio files
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
          </>
        )}
      </div>

      {/* Footer */}
      <AppFooter libraryData={libraryData} />
    </div>
  );
};

export default App;
