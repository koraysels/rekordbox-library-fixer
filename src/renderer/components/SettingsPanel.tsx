import React, { useCallback } from 'react';
import { FolderOpen, Plus, X } from 'lucide-react';
import type { ScanOptions, ResolutionStrategy } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  scanOptions: ScanOptions;
  setScanOptions: (options: ScanOptions) => void;
  resolutionStrategy: ResolutionStrategy;
  setResolutionStrategy: (strategy: ResolutionStrategy) => void;
  pathPreferenceInput: string;
  setPathPreferenceInput: (input: string) => void;
  addPathPreference: () => void;
  removePathPreference: (index: number) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  scanOptions,
  setScanOptions,
  resolutionStrategy,
  setResolutionStrategy,
  pathPreferenceInput,
  setPathPreferenceInput,
  addPathPreference,
  removePathPreference
}) => {
  // Handle folder browsing for path preferences
  const handleBrowseFolder = useCallback(async () => {
    try {
      const folderPath = await window.electronAPI.selectFolder();
      if (folderPath) {
        setPathPreferenceInput(folderPath);
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  }, [setPathPreferenceInput]);
  return (
    <div className="space-y-8">
          {/* Detection Methods */}
          <div>
            <h3 className="font-semibold mb-4 text-lg">Detection Methods</h3>
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={scanOptions.useFingerprint}
                  onChange={(e) => setScanOptions({
                    ...scanOptions,
                    useFingerprint: e.target.checked
                  })}
                  className="checkbox"
                />
                <div>
                  <span className="font-medium">Audio Fingerprinting</span>
                  <p className="text-sm text-zinc-400">Most accurate detection method</p>
                </div>
              </label>
              
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={scanOptions.useMetadata}
                  onChange={(e) => setScanOptions({
                    ...scanOptions,
                    useMetadata: e.target.checked
                  })}
                  className="checkbox"
                />
                <div>
                  <span className="font-medium">Metadata Matching</span>
                  <p className="text-sm text-zinc-400">Compare by track information</p>
                </div>
              </label>

              {scanOptions.useMetadata && (
                <div className="ml-8 space-y-2 mt-3">
                  <p className="text-sm text-zinc-400 mb-3">Match by:</p>
                  {['artist', 'title', 'album', 'duration', 'bpm'].map(field => (
                    <label key={field} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={(scanOptions.metadataFields || []).includes(field)}
                        onChange={(e) => {
                          const fields = e.target.checked
                            ? [...(scanOptions.metadataFields || []), field]
                            : (scanOptions.metadataFields || []).filter(f => f !== field);
                          setScanOptions({
                            ...scanOptions,
                            metadataFields: fields
                          });
                        }}
                        className="checkbox"
                      />
                      <span className="capitalize text-sm">{field}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Resolution Strategy */}
          <div>
            <h3 className="font-semibold mb-4 text-lg">Resolution Strategy</h3>
            <div className="space-y-3">
              <label className="flex items-start space-x-3 p-4 rounded-lg border border-zinc-700 hover:border-zinc-600 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="strategy"
                  value="keep-highest-quality"
                  checked={resolutionStrategy === 'keep-highest-quality'}
                  onChange={(e) => setResolutionStrategy(e.target.value as ResolutionStrategy)}
                  className="mt-1 text-rekordbox-purple"
                />
                <div>
                  <span className="font-medium">Keep Highest Quality</span>
                  <p className="text-sm text-zinc-400">Keeps tracks with higher bitrate and file size</p>
                </div>
              </label>
              
              <label className="flex items-start space-x-3 p-4 rounded-lg border border-zinc-700 hover:border-zinc-600 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="strategy"
                  value="keep-newest"
                  checked={resolutionStrategy === 'keep-newest'}
                  onChange={(e) => setResolutionStrategy(e.target.value as ResolutionStrategy)}
                  className="mt-1 text-rekordbox-purple"
                />
                <div>
                  <span className="font-medium">Keep Newest</span>
                  <p className="text-sm text-zinc-400">Keeps tracks with most recent modification date</p>
                </div>
              </label>
              
              <label className="flex items-start space-x-3 p-4 rounded-lg border border-zinc-700 hover:border-zinc-600 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="strategy"
                  value="keep-oldest"
                  checked={resolutionStrategy === 'keep-oldest'}
                  onChange={(e) => setResolutionStrategy(e.target.value as ResolutionStrategy)}
                  className="mt-1 text-rekordbox-purple"
                />
                <div>
                  <span className="font-medium">Keep Oldest</span>
                  <p className="text-sm text-zinc-400">Keeps tracks that were added to library first</p>
                </div>
              </label>
              
              <label className={`flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                resolutionStrategy === 'keep-preferred-path' 
                  ? 'border-rekordbox-purple bg-rekordbox-purple/10' 
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}>
                <input
                  type="radio"
                  name="strategy"
                  value="keep-preferred-path"
                  checked={resolutionStrategy === 'keep-preferred-path'}
                  onChange={(e) => setResolutionStrategy(e.target.value as ResolutionStrategy)}
                  className="mt-1 text-rekordbox-purple"
                />
                <div>
                  <span className="font-medium">Keep Preferred Path</span>
                  <p className="text-sm text-zinc-400">Keeps tracks from your preferred folders/locations</p>
                </div>
              </label>
              
              <label className="flex items-start space-x-3 p-4 rounded-lg border border-zinc-700 hover:border-zinc-600 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="strategy"
                  value="manual"
                  checked={resolutionStrategy === 'manual'}
                  onChange={(e) => setResolutionStrategy(e.target.value as ResolutionStrategy)}
                  className="mt-1 text-rekordbox-purple"
                />
                <div>
                  <span className="font-medium">Manual Selection</span>
                  <p className="text-sm text-zinc-400">Let you choose which track to keep for each duplicate</p>
                </div>
              </label>
            </div>
          </div>

          {/* Path Preferences */}
          <div>
            <h3 className="font-semibold mb-4 text-lg">Path Preferences</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Preferred paths/folders when using "Keep Preferred Path" strategy. Higher priority paths should be listed first.
            </p>
            
            <div className="flex space-x-2 mb-4">
              <input
                type="text"
                value={pathPreferenceInput}
                onChange={(e) => setPathPreferenceInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addPathPreference()}
                placeholder="e.g., /Users/DJ/Main Library"
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
                onClick={addPathPreference}
                disabled={!pathPreferenceInput.trim()}
                className="px-4 py-2 bg-rekordbox-purple hover:bg-purple-600 disabled:bg-zinc-600 text-white rounded-lg transition-colors flex items-center space-x-1"
              >
                <Plus size={16} />
                <span>Add</span>
              </button>
            </div>

            {(scanOptions.pathPreferences || []).length === 0 ? (
              <div className="text-center py-8 border border-dashed border-zinc-600 rounded-lg">
                <div className="text-4xl mb-2">📂</div>
                <p className="text-zinc-400 text-sm mb-1">No preferred paths set</p>
                <p className="text-zinc-500 text-xs">Add paths to prioritize when resolving duplicates</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(scanOptions.pathPreferences || []).map((path, index) => (
                  <div key={index} className="flex items-center justify-between bg-zinc-800 px-3 py-3 rounded border border-zinc-700">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <span className="text-rekordbox-purple font-semibold text-sm">#{index + 1}</span>
                      <span className="font-mono text-sm text-zinc-200 truncate">{path}</span>
                    </div>
                    <button
                      onClick={() => removePathPreference(index)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20 px-2 py-1 rounded ml-2 transition-colors"
                      title="Remove this path preference"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
    </div>
  );
};