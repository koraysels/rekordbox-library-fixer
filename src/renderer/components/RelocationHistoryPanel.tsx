import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  Target,
  Zap,
  ExternalLink,
  Trash2,
  TrendingUp,
  BarChart3,
  RefreshCw,
  FileText,
  Shield
} from 'lucide-react';
import { historyStorage, historyEvents, type RelocationHistoryEntry } from '../db/historyDb';

interface RelocationHistoryPanelProps {
  libraryPath: string | null;
  onShowFileInFolder?: (filePath: string) => void;
}

interface HistoryStats {
  totalRelocations: number;
  autoRelocations: number;
  manualRelocations: number;
  averageConfidence: number;
  recentRelocations: number;
}

export const RelocationHistoryPanel: React.FC<RelocationHistoryPanelProps> = ({
  libraryPath,
  onShowFileInFolder
}) => {
  const [history, setHistory] = useState<RelocationHistoryEntry[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'auto' | 'manual'>('all');

  const loadHistory = useCallback(async () => {
    if (!libraryPath) {
      console.log('⚠️ No library path for history');
      return;
    }

    console.log(`🔄 Loading history for: ${libraryPath}`);
    setIsLoading(true);
    try {
      const [historyData, statsData] = await Promise.all([
        historyStorage.getRelocationHistory(libraryPath),
        historyStorage.getRelocationStats(libraryPath)
      ]);

      console.log(`📊 Loaded ${historyData.length} history entries`);
      setHistory(historyData);
      setStats(statsData);
    } catch (error) {
      console.error('❌ Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [libraryPath]);

  useEffect(() => {
    loadHistory();
  }, [libraryPath]);

  // Auto-refresh when history is updated
  useEffect(() => {
    if (!libraryPath) {return;}

    console.log(`📡 Setting up history auto-refresh for: ${libraryPath}`);
    const unsubscribe = historyEvents.onHistoryUpdate((updatedLibraryPath) => {
      // Only refresh if it's for the current library
      if (updatedLibraryPath === libraryPath) {
        console.log(`🔄 Auto-refreshing history for: ${updatedLibraryPath}`);
        loadHistory();
      }
    });

    return unsubscribe;
  }, [libraryPath, loadHistory]);

  const clearHistory = async () => {
    if (!libraryPath) {return;}

    if (confirm('Are you sure you want to clear all relocation history? This cannot be undone.')) {
      try {
        await historyStorage.clearRelocationHistory(libraryPath);
        setHistory([]);
        setStats(null);
      } catch (error) {
        console.error('Failed to clear history:', error);
      }
    }
  };

  const filteredHistory = history.filter(entry => {
    if (filter === 'all') {return true;}
    return entry.relocationMethod === filter;
  });

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) {return `${minutes}m ago`;}
    if (hours < 24) {return `${hours}h ago`;}
    return `${days}d ago`;
  };

  if (!libraryPath) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center te-label">
          <History size={48} className="mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Library Loaded</h3>
          <p>Load a library to view relocation history</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-te-grey-100">
      {/* Sticky Header with bigger stats */}
      <div className="sticky top-0 z-10 flex-shrink-0 p-4 border-b-2 border-te-grey-300 bg-te-grey-200">

        {/* Stats - Bigger and more prominent */}
        {stats && (
          <div className="flex items-center justify-between space-x-6 mb-3">
            <div className="flex items-center space-x-2">
              <BarChart3 size={16} className="text-te-grey-600" />
              <span className="text-sm te-label">Total:</span>
              <span className="text-lg font-bold te-value">{stats.totalRelocations}</span>
            </div>

            <div className="flex items-center space-x-2">
              <Zap size={16} className="text-te-green-500" />
              <span className="text-sm te-label">Auto:</span>
              <span className="text-lg font-bold te-value">{stats.autoRelocations}</span>
            </div>

            <div className="flex items-center space-x-2">
              <Target size={16} className="text-te-orange" />
              <span className="text-sm te-label">Manual:</span>
              <span className="text-lg font-bold te-value">{stats.manualRelocations}</span>
            </div>

            <div className="flex items-center space-x-2">
              <TrendingUp size={16} className="text-te-amber-500" />
              <span className="text-sm te-label">Avg Confidence:</span>
              <span className="text-lg font-bold te-value">
                {stats.averageConfidence > 0 ? `${Math.round(stats.averageConfidence * 100)}%` : 'N/A'}
              </span>
            </div>
          </div>
        )}

        {/* Filter and Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            {(['all', 'auto', 'manual'] as const).map((filterType) => (
              <button
                key={filterType}
                onClick={() => setFilter(filterType)}
                className={`px-3 py-1.5 rounded-te text-sm font-medium transition-colors border-2 ${
                  filter === filterType
                    ? 'bg-te-orange text-te-cream border-te-orange'
                    : 'bg-te-grey-300 text-te-grey-700 border-te-grey-400 hover:bg-te-grey-400'
                }`}
              >
                {filterType === 'all' ? 'All' : filterType === 'auto' ? 'Auto' : 'Manual'}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <button
                onClick={loadHistory}
                disabled={isLoading}
                className="p-2 bg-te-grey-300 hover:bg-te-grey-400 rounded-te border-2 border-te-grey-400 transition-colors disabled:opacity-50"
                title="Refresh History"
            >
              <RefreshCw size={16} className={`text-te-grey-700 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
                onClick={clearHistory}
                className="p-2 bg-te-red-500 hover:bg-te-red-600 rounded-te border-2 border-te-red-500 text-te-cream transition-colors"
                title="Clear History"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable History Items Container */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw size={24} className="animate-spin text-te-orange" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center te-label py-8">
              <History size={48} className="mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No History Found</h3>
              <p>
                {filter === 'all'
                  ? 'No relocations have been performed yet'
                  : `No ${filter} relocations found`
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-te-cream rounded-te p-4 border-2 border-te-grey-300 hover:border-te-grey-400 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {entry.relocationMethod === 'auto' ? (
                        <Zap size={16} className="text-te-green-500" />
                      ) : (
                        <Target size={16} className="text-te-orange" />
                      )}
                      <span className="text-sm font-medium te-label uppercase">
                        {entry.relocationMethod}
                      </span>
                      {entry.confidence && (
                        <span className={`text-sm px-2 py-0.5 rounded-te border ${
                          entry.confidence > 0.8
                            ? 'bg-te-green-100 text-te-green-600 border-te-green-200'
                            : entry.confidence > 0.6
                              ? 'bg-te-amber-100 text-te-amber-600 border-te-amber-200'
                              : 'bg-te-red-100 text-te-red-500 border-te-red-200'
                        } font-te-mono font-medium`}>
                          {Math.round(entry.confidence * 100)}%
                        </span>
                      )}
                      {entry.xmlUpdated && (
                        <FileText size={12} className="text-te-grey-600" title="XML Updated" />
                      )}
                      {entry.backupCreated && (
                        <Shield size={12} className="text-te-green-500" title="Backup Created" />
                      )}
                    </div>
                    <span className="text-xs text-te-grey-500">
                      {formatTimeAgo(entry.timestamp)}
                    </span>
                  </div>

                  <div className="mb-3">
                    <h4 className="text-sm te-value font-medium truncate">{entry.trackName}</h4>
                    <p className="text-xs te-label truncate">{entry.trackArtist}</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-te-grey-500">From:</span>
                      <p className="text-xs te-label font-te-mono truncate flex-1" title={entry.originalLocation}>
                        {entry.originalLocation}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-te-grey-500">To:</span>
                      <p className="text-xs text-te-green-500 font-te-mono truncate flex-1" title={entry.newLocation}>
                        {entry.newLocation}
                      </p>
                      {onShowFileInFolder && (
                        <button
                          onClick={() => onShowFileInFolder(entry.newLocation)}
                          className="p-1 bg-te-orange hover:bg-te-orange/90 text-te-cream rounded-te border border-te-orange transition-colors"
                          title="Show in Finder/Explorer"
                        >
                          <ExternalLink size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
