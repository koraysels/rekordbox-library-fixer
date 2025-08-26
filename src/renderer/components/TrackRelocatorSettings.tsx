import React from 'react';
import { Plus, X, FolderOpen } from 'lucide-react';
import type { RelocationOptions } from '../types';

interface TrackRelocatorSettingsProps {
  searchOptions: RelocationOptions;
  updateSearchOptions: (options: Partial<RelocationOptions>) => void;
  newSearchPath: string;
  setNewSearchPath: (path: string) => void;
  addSearchPath: () => void;
  removeSearchPath: (index: number) => void;
}

export const TrackRelocatorSettings: React.FC<TrackRelocatorSettingsProps> = ({
  searchOptions,
  updateSearchOptions,
  newSearchPath,
  setNewSearchPath,
  addSearchPath,
  removeSearchPath
}) => {
  const handleBrowseFolder = async () => {
    try {
      const folderPath = await window.electronAPI.selectFolder();
      if (folderPath) {
        setNewSearchPath(folderPath);
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  };
  return (
    <div className="space-y-8">
      {/* Search Configuration */}
      <div>
        <h3 className="font-semibold mb-4 text-lg">Search Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-300 mb-2">Search Depth</label>
            <input
              type="number"
              min="1"
              max="10"
              value={searchOptions.searchDepth}
              onChange={(e) => updateSearchOptions({ searchDepth: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white focus:border-rekordbox-purple focus:outline-none"
            />
            <p className="text-xs text-zinc-400 mt-1">How many folder levels deep to search</p>
          </div>
          <div>
            <label className="block text-sm text-zinc-300 mb-2">Match Threshold</label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={searchOptions.matchThreshold}
              onChange={(e) => updateSearchOptions({ matchThreshold: parseFloat(e.target.value) })}
              className="w-full accent-rekordbox-purple"
            />
            <div className="flex justify-between text-xs text-zinc-400 mt-1">
              <span>10%</span>
              <span className="text-rekordbox-purple font-medium">{Math.round(searchOptions.matchThreshold * 100)}% similarity</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      </div>

      {/* File Extensions */}
      <div>
        <h3 className="font-semibold mb-4 text-lg">File Extensions</h3>
        <div className="flex flex-wrap gap-2">
          {searchOptions.fileExtensions.map((ext) => (
            <span key={ext} className="px-3 py-1 bg-zinc-800 border border-zinc-600 rounded-md text-sm">
              {ext}
            </span>
          ))}
        </div>
        <p className="text-sm text-zinc-400 mt-2">
          Audio file types to search for during relocation
        </p>
      </div>

      {/* Search Paths */}
      <div>
        <h3 className="font-semibold mb-4 text-lg">Search Paths</h3>
        <p className="text-sm text-zinc-400 mb-4">
          Configure where to look for relocated audio files. Add directories where your music might be located.
        </p>
        
        <div className="flex space-x-2 mb-4">
          <input
            type="text"
            value={newSearchPath}
            onChange={(e) => setNewSearchPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSearchPath()}
            placeholder="Enter path where tracks might be located..."
            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white placeholder:text-zinc-500 focus:border-rekordbox-purple focus:outline-none"
          />
          <button
            onClick={handleBrowseFolder}
            className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors flex items-center"
            title="Browse for folder"
          >
            <FolderOpen size={16} />
          </button>
          <button
            onClick={addSearchPath}
            disabled={!newSearchPath.trim()}
            className="px-4 py-2 bg-rekordbox-purple hover:bg-purple-600 disabled:bg-zinc-600 text-white rounded-lg transition-colors flex items-center space-x-1"
          >
            <Plus size={16} />
            <span>Add</span>
          </button>
        </div>

        {searchOptions.searchPaths.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-zinc-600 rounded-lg">
            <div className="text-4xl mb-2">📂</div>
            <p className="text-zinc-400 text-sm mb-1">No search paths configured</p>
            <p className="text-zinc-500 text-xs">Add paths where your audio files might be located</p>
          </div>
        ) : (
          <div className="space-y-2">
            {searchOptions.searchPaths.map((path, index) => (
              <div key={index} className="flex items-center justify-between bg-zinc-800 px-3 py-3 rounded border border-zinc-700">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <span className="text-rekordbox-purple font-semibold text-sm">#{index + 1}</span>
                  <span className="font-mono text-sm text-zinc-200 truncate">{path}</span>
                </div>
                <button
                  onClick={() => removeSearchPath(index)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20 px-2 py-1 rounded ml-2 transition-colors"
                  title="Remove this search path"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Search Options */}
      <div>
        <h3 className="font-semibold mb-4 text-lg">Search Options</h3>
        <div className="space-y-3">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={searchOptions.includeSubdirectories}
              onChange={(e) => updateSearchOptions({ includeSubdirectories: e.target.checked })}
              className="rounded border-zinc-600 text-rekordbox-purple focus:ring-purple-500"
            />
            <div>
              <span className="font-medium">Include Subdirectories</span>
              <p className="text-sm text-zinc-400">Search within subdirectories of the configured paths</p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};