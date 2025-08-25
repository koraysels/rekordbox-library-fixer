import React, { useState, useEffect } from 'react';
import { 
  Disc3, 
  FolderOpen, 
  Search, 
  AlertCircle,
  CheckCircle,
  Music,
  Settings,
  Loader2
} from 'lucide-react';
import DuplicateDetector from './components/DuplicateDetector';

declare global {
  interface Window {
    electronAPI: {
      selectRekordboxXML: () => Promise<string | null>;
      parseRekordboxLibrary: (xmlPath: string) => Promise<any>;
      findDuplicates: (options: any) => Promise<any>;
      resolveDuplicates: (resolution: any) => Promise<any>;
      saveRekordboxXML: (data: any) => Promise<any>;
      showFileInFolder: (filePath: string) => Promise<any>;
      saveDuplicateResults: (data: any) => Promise<any>;
      getDuplicateResults: (libraryPath: string) => Promise<any>;
      deleteDuplicateResults: (libraryPath: string) => Promise<any>;
    };
  }
}

type TabType = 'duplicates' | 'import' | 'relocate' | 'maintenance';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('duplicates');
  const [libraryPath, setLibraryPath] = useState<string>('');
  const [libraryData, setLibraryData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const selectLibrary = async () => {
    try {
      const path = await window.electronAPI.selectRekordboxXML();
      if (path) {
        // Clear previous library data when selecting new library
        setLibraryData(null);
        setLibraryPath(path);
        await loadLibrary(path);
      }
    } catch (error) {
      showNotification('error', 'Failed to select library file');
    }
  };

  const loadLibrary = async (path: string) => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.parseRekordboxLibrary(path);
      if (result.success) {
        setLibraryData(result.data);
        showNotification('success', `Loaded ${result.data.tracks.size} tracks from library`);
      } else {
        showNotification('error', result.error || 'Failed to parse library');
      }
    } catch (error) {
      showNotification('error', 'Failed to load library');
    } finally {
      setIsLoading(false);
    }
  };

  // Load persisted library data on mount
  useEffect(() => {
    const savedLibraryPath = localStorage.getItem('rekordboxLibraryPath');
    const savedLibraryData = localStorage.getItem('rekordboxLibraryData');
    
    if (savedLibraryPath) {
      setLibraryPath(savedLibraryPath);
    }
    
    if (savedLibraryData) {
      try {
        const parsedData = JSON.parse(savedLibraryData);
        // Convert tracks array back to Map
        if (parsedData && parsedData.tracks && Array.isArray(parsedData.tracks)) {
          parsedData.tracks = new Map(parsedData.tracks);
          setLibraryData(parsedData);
        }
      } catch (error) {
        console.warn('Failed to load saved library data:', error);
        localStorage.removeItem('rekordboxLibraryData');
      }
    }
  }, []);

  // Save library data whenever it changes
  useEffect(() => {
    if (libraryData) {
      try {
        // Convert Map to array for JSON serialization
        const dataToSave = {
          ...libraryData,
          tracks: Array.from(libraryData.tracks.entries())
        };
        localStorage.setItem('rekordboxLibraryData', JSON.stringify(dataToSave));
      } catch (error) {
        console.warn('Failed to save library data:', error);
      }
    }
  }, [libraryData]);

  // Save library path whenever it changes
  useEffect(() => {
    if (libraryPath) {
      localStorage.setItem('rekordboxLibraryPath', libraryPath);
    }
  }, [libraryPath]);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const clearStoredData = () => {
    localStorage.removeItem('rekordboxLibraryPath');
    localStorage.removeItem('rekordboxLibraryData');
    setLibraryPath('');
    setLibraryData(null);
    showNotification('info', 'Library data cleared');
  };

  const tabs = [
    { id: 'duplicates' as TabType, label: 'Duplicate Detection', icon: Search },
    { id: 'import' as TabType, label: 'Auto Import', icon: FolderOpen },
    { id: 'relocate' as TabType, label: 'Track Relocation', icon: Disc3 },
    { id: 'maintenance' as TabType, label: 'Maintenance', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-rekordbox-dark">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 app-header bg-gradient-to-r from-rekordbox-purple to-purple-700 px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Music className="w-8 h-8 text-white" />
            <div>
              <h1 className="text-2xl font-bold text-white">Rekordbox Library Manager</h1>
              <p className="text-purple-100 text-sm">Fix and optimize your DJ library</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {libraryPath && (
              <div className="text-right">
                <p className="text-purple-100 text-xs">Current Library</p>
                <p className="text-white text-sm font-medium max-w-xs" title={libraryPath}>
                  {libraryPath.length > 40 ? '...' + libraryPath.slice(-37) : libraryPath.split('/').pop()}
                </p>
              </div>
            )}
            <button
              onClick={selectLibrary}
              className="btn-primary flex items-center space-x-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FolderOpen className="w-4 h-4" />
              )}
              <span>{libraryPath ? 'Change Library' : 'Select Library'}</span>
            </button>
          </div>
        </div>
      </header>
      
      {/* Header Spacer */}
      <div className="h-28"></div>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-28 right-6 z-40 p-4 rounded-lg shadow-xl flex items-center space-x-3 ${
          notification.type === 'success' ? 'bg-green-600' :
          notification.type === 'error' ? 'bg-red-600' :
          'bg-blue-600'
        } text-white`}>
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-zinc-800">
        <div className="px-6 flex space-x-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 font-medium text-sm flex items-center space-x-2 border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'text-rekordbox-purple border-rekordbox-purple'
                    : 'text-zinc-400 border-transparent hover:text-zinc-200'
                }`}
                disabled={!libraryData && tab.id !== 'duplicates'}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 pb-20">
        {!libraryData ? (
          <div className="card text-center py-20">
            <Music className="w-20 h-20 mx-auto text-zinc-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Library Loaded</h3>
            <p className="text-zinc-400 mb-6">
              Select your Rekordbox XML library file to get started
            </p>
            <button
              onClick={selectLibrary}
              className="btn-primary mx-auto flex items-center space-x-2"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Select Library</span>
            </button>
          </div>
        ) : (
          <>
            {/* Keep DuplicateDetector always mounted to preserve state */}
            <div style={{ display: activeTab === 'duplicates' ? 'block' : 'none' }}>
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
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-zinc-400">
            {libraryData && (
              <span>
                Library: {libraryData.tracks.size} tracks • {libraryData.playlists.length} playlists
              </span>
            )}
          </div>
          <div className="text-xs text-zinc-500">
            Version 1.0.0 • Made with ❤️ for DJs
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
