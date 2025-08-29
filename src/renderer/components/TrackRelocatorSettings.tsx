import React from 'react';
import { Plus, X, FolderOpen } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import type { RelocationOptions } from '../types';

interface TrackRelocatorSettingsProps {
  searchOptions: RelocationOptions;
  newSearchPath: string;
  setNewSearchPath: (path: string) => void;
  addSearchPath: () => void;
  removeSearchPath: (index: number) => void;
}

export const TrackRelocatorSettings: React.FC<TrackRelocatorSettingsProps> = ({
  searchOptions,
  newSearchPath,
  setNewSearchPath,
  addSearchPath,
  removeSearchPath
}) => {
  // Get store functions for direct updates (avoid feedback loops)
  const updateRelocationOption = useSettingsStore((state) => state.updateRelocationOption);
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
    <div className="space-y-8 p-6 bg-te-grey-100">
      {/* Search Configuration */}
      <div>
        <h3 className="te-title mb-4">Search Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm te-label mb-2 font-te-mono">Search Depth</label>
            <input
              type="number"
              min="1"
              max="10"
              value={searchOptions.searchDepth}
              onChange={(e) => {
                const newValue = parseInt(e.target.value);
                updateRelocationOption('searchDepth', newValue);
              }}
              className="input w-full"
            />
            <p className="text-xs te-label mt-1 font-te-mono">How many folder levels deep to search</p>
          </div>
          <div>
            <label className="block text-sm te-label mb-2 font-te-mono">Match Threshold</label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={searchOptions.matchThreshold}
              onChange={(e) => {
                const newValue = parseFloat(e.target.value);
                updateRelocationOption('matchThreshold', newValue);
              }}
              className="w-full accent-te-orange"
            />
            <div className="flex justify-between text-xs te-label mt-1 font-te-mono">
              <span>10%</span>
              <span className="text-te-orange font-medium">{Math.round(searchOptions.matchThreshold * 100)}% similarity</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      </div>

      {/* File Extensions */}
      <div>
        <h3 className="te-title mb-4">File Extensions</h3>
        <div className="flex flex-wrap gap-2">
          {searchOptions.fileExtensions.map((ext) => (
            <span key={ext} className="px-3 py-1 bg-te-grey-300 border-2 border-te-grey-400 rounded-te text-sm te-value font-te-mono">
              {ext}
            </span>
          ))}
        </div>
        <p className="text-sm te-label mt-2 font-te-mono">
          Audio file types to search for during relocation
        </p>
      </div>

      {/* Search Paths */}
      <div>
        <h3 className="te-title mb-4">Search Paths</h3>
        <p className="text-sm te-label mb-4 font-te-mono">
          Configure where to look for relocated audio files. Add directories where your music might be located.
        </p>

        <div className="flex space-x-2 mb-4">
          <input
            type="text"
            value={newSearchPath}
            onChange={(e) => setNewSearchPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSearchPath()}
            placeholder="Enter path where tracks might be located..."
            className="input flex-1"
          />
          <button
            onClick={handleBrowseFolder}
            className="px-3 py-2 bg-te-grey-500 hover:bg-te-grey-600 text-te-cream rounded-te transition-colors flex items-center"
            title="Browse for folder"
          >
            <FolderOpen size={16} />
          </button>
          <button
            onClick={addSearchPath}
            disabled={!newSearchPath.trim()}
            className="btn-primary px-4 py-2 flex items-center space-x-1"
          >
            <Plus size={16} />
            <span>Add</span>
          </button>
        </div>

        {searchOptions.searchPaths.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-te-grey-400 rounded-te">
            <div className="text-4xl mb-2">📂</div>
            <p className="te-value text-sm mb-1 font-te-mono">No search paths configured</p>
            <p className="te-label text-xs font-te-mono">Add paths where your audio files might be located</p>
          </div>
        ) : (
          <div className="space-y-2">
            {searchOptions.searchPaths.map((path, index) => (
              <div key={index} className="card px-3 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <span className="text-te-orange font-semibold text-sm font-te-mono">#{index + 1}</span>
                  <span className="font-te-mono text-sm te-value truncate">{path}</span>
                </div>
                <button
                  onClick={() => removeSearchPath(index)}
                  className="text-te-red hover:text-te-red/80 hover:bg-te-red/10 px-2 py-1 rounded-te ml-2 transition-colors"
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
        <h3 className="te-title mb-4">Search Options</h3>
        <div className="space-y-3">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={searchOptions.includeSubdirectories}
              onChange={(e) => updateRelocationOption('includeSubdirectories', e.target.checked)}
              className="rounded border-te-grey-400 text-te-orange focus:ring-te-orange"
            />
            <div>
              <span className="font-medium te-value font-te-mono">Include Subdirectories</span>
              <p className="text-sm te-label font-te-mono">Search within subdirectories of the configured paths</p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};
