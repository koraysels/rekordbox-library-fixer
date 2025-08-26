import React, { useCallback } from 'react';
import { X } from 'lucide-react';
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
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}
      
      {/* Slideout Panel */}
      <div 
        className={`fixed right-0 top-0 h-full w-96 bg-zinc-900 border-l border-zinc-700 transform transition-transform duration-300 ease-in-out z-50 overflow-y-auto ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <h2 className="text-xl font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
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
                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-sm"
              />
              <button
                onClick={addPathPreference}
                disabled={!pathPreferenceInput.trim()}
                className="px-4 py-2 bg-rekordbox-purple hover:bg-purple-600 disabled:bg-gray-600 rounded text-sm"
              >
                Add
              </button>
            </div>

            <div className="space-y-2">
              {(scanOptions.pathPreferences || []).map((path, index) => (
                <div key={index} className="flex items-center justify-between bg-zinc-800 px-3 py-3 rounded border border-zinc-700">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <span className="text-rekordbox-purple font-semibold text-sm">#{index + 1}</span>
                    <span className="font-mono text-sm text-zinc-200 truncate">{path}</span>
                  </div>
                  <button
                    onClick={() => removePathPreference(index)}
                    className="text-red-400 hover:text-red-300 text-sm hover:bg-red-900/20 px-2 py-1 rounded ml-2"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {(scanOptions.pathPreferences || []).length === 0 && (
                <div className="text-center py-6 text-zinc-500">
                  <div className="text-2xl mb-2">📂</div>
                  <p className="text-sm">No preferred paths set</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};