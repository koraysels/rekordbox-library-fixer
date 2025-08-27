import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  Clock,
  Target,
  Zap,
  ExternalLink,
  Trash2,
  TrendingUp,
  Calendar,
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
    if (!libraryPath) return;
    
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
    if (!libraryPath) return;
    
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
    if (filter === 'all') return true;
    return entry.relocationMethod === filter;
  });

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (!libraryPath) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center text-gray-400">
          <History size={48} className="mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Library Loaded</h3>
          <p>Load a library to view relocation history</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-850">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <History size={20} className="text-rekordbox-purple" />
            <h2 className="text-lg font-semibold text-white">Relocation History</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadHistory}
              disabled={isLoading}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh History"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={clearHistory}
              className="p-2 bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
              title="Clear History"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-1">
                <BarChart3 size={14} className="text-blue-400" />
                <span className="text-xs text-gray-400">Total</span>
              </div>
              <p className="text-lg font-semibold text-white">{stats.totalRelocations}</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-1">
                <Zap size={14} className="text-green-400" />
                <span className="text-xs text-gray-400">Auto</span>
              </div>
              <p className="text-lg font-semibold text-white">{stats.autoRelocations}</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-1">
                <Target size={14} className="text-purple-400" />
                <span className="text-xs text-gray-400">Manual</span>
              </div>
              <p className="text-lg font-semibold text-white">{stats.manualRelocations}</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-1">
                <TrendingUp size={14} className="text-yellow-400" />
                <span className="text-xs text-gray-400">Avg Confidence</span>
              </div>
              <p className="text-lg font-semibold text-white">
                {stats.averageConfidence > 0 ? `${Math.round(stats.averageConfidence * 100)}%` : 'N/A'}
              </p>
            </div>
          </div>
        )}

        {/* Filter Buttons */}
        <div className="flex space-x-2">
          {(['all', 'auto', 'manual'] as const).map((filterType) => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === filterType
                  ? 'bg-rekordbox-purple text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {filterType === 'all' ? 'All' : filterType === 'auto' ? 'Auto' : 'Manual'}
            </button>
          ))}
        </div>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw size={24} className="animate-spin text-rekordbox-purple" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
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
                className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {entry.relocationMethod === 'auto' ? (
                      <Zap size={16} className="text-green-400" />
                    ) : (
                      <Target size={16} className="text-purple-400" />
                    )}
                    <span className="text-xs font-medium text-gray-400 uppercase">
                      {entry.relocationMethod}
                    </span>
                    {entry.confidence && (
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        entry.confidence > 0.8 
                          ? 'bg-green-600 text-white' 
                          : entry.confidence > 0.6
                            ? 'bg-yellow-600 text-white'
                            : 'bg-red-600 text-white'
                      }`}>
                        {Math.round(entry.confidence * 100)}%
                      </span>
                    )}
                    {entry.xmlUpdated && (
                      <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded flex items-center space-x-1">
                        <FileText size={10} />
                        <span>XML Updated</span>
                      </span>
                    )}
                    {entry.backupCreated && (
                      <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded flex items-center space-x-1">
                        <Shield size={10} />
                        <span>Backup Created</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-400">
                    <Clock size={12} />
                    <span>{formatTimeAgo(entry.timestamp)}</span>
                  </div>
                </div>

                <div className="mb-3">
                  <h4 className="text-white font-medium truncate">{entry.trackName}</h4>
                  <p className="text-sm text-gray-400 truncate">{entry.trackArtist}</p>
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Original Location:</p>
                    <p className="text-xs text-gray-300 font-mono bg-gray-900 rounded px-2 py-1 truncate">
                      {entry.originalLocation}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-500 mb-1">New Location:</p>
                    <div className="flex items-center space-x-2">
                      <p className="text-xs text-green-300 font-mono bg-gray-900 rounded px-2 py-1 truncate flex-1">
                        {entry.newLocation}
                      </p>
                      {onShowFileInFolder && (
                        <button
                          onClick={() => onShowFileInFolder(entry.newLocation)}
                          className="p-1 hover:bg-gray-700 rounded transition-colors"
                          title="Show in Finder/Explorer"
                        >
                          <ExternalLink size={12} className="text-gray-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};