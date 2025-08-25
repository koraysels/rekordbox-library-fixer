import React, { useState } from 'react';
import {
  Search,
  Settings,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import DuplicateItem from './DuplicateItem';

interface DuplicateDetectorProps {
  libraryData: any;
  onUpdate: (updatedLibrary: any) => void;
  showNotification: (type: 'success' | 'error' | 'info', message: string) => void;
}

const DuplicateDetector: React.FC<DuplicateDetectorProps> = ({
  libraryData,
  showNotification
}) => {
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<string>>(new Set());
  const [scanOptions, setScanOptions] = useState({
    useFingerprint: true,
    useMetadata: false,
    metadataFields: ['artist', 'title', 'duration'],
    pathPreferences: [] as string[]
  });
  const [resolutionStrategy, setResolutionStrategy] = useState<
    'keep-highest-quality' | 'keep-newest' | 'keep-oldest' | 'keep-preferred-path' | 'manual'
  >('keep-highest-quality');
  const [pathPreferenceInput, setPathPreferenceInput] = useState('');

  const scanForDuplicates = async () => {
    setIsScanning(true);
    try {
      const tracks = Array.from(libraryData.tracks.values());
      const result = await window.electronAPI.findDuplicates({
        tracks,
        ...scanOptions
      });
      
      if (result.success) {
        setDuplicates(result.data);
        showNotification(
          result.data.length > 0 ? 'info' : 'success',
          result.data.length > 0 
            ? `Found ${result.data.length} duplicate sets`
            : 'No duplicates found in your library!'
        );
      } else {
        showNotification('error', result.error || 'Scan failed');
      }
    } catch (error) {
      showNotification('error', 'Failed to scan for duplicates');
    } finally {
      setIsScanning(false);
    }
  };

  const resolveDuplicates = async () => {
    if (selectedDuplicates.size === 0) {
      showNotification('error', 'Please select duplicates to resolve');
      return;
    }

    const selectedDuplicateSets = duplicates.filter(d => 
      selectedDuplicates.has(d.id)
    );

    try {
      const result = await window.electronAPI.resolveDuplicates({
        duplicates: selectedDuplicateSets,
        strategy: resolutionStrategy,
        pathPreferences: scanOptions.pathPreferences,
      });

      if (result.success) {
        // Remove resolved duplicates from the list
        setDuplicates(duplicates.filter(d => !selectedDuplicates.has(d.id)));
        setSelectedDuplicates(new Set());
        showNotification('success', `Resolved ${selectedDuplicates.size} duplicate sets`);
        
        // Update library data
        // This would need to be implemented based on the resolution result
      }
    } catch (error) {
      showNotification('error', 'Failed to resolve duplicates');
    }
  };

  const toggleDuplicateSelection = (id: string) => {
    const newSelection = new Set(selectedDuplicates);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedDuplicates(newSelection);
  };

  const selectAll = () => {
    setSelectedDuplicates(new Set(duplicates.map(d => d.id)));
  };

  const deselectAll = () => {
    setSelectedDuplicates(new Set());
  };

  const addPathPreference = () => {
    if (pathPreferenceInput.trim() && !scanOptions.pathPreferences.includes(pathPreferenceInput.trim())) {
      setScanOptions({
        ...scanOptions,
        pathPreferences: [...scanOptions.pathPreferences, pathPreferenceInput.trim()]
      });
      setPathPreferenceInput('');
    }
  };

  const removePathPreference = (index: number) => {
    setScanOptions({
      ...scanOptions,
      pathPreferences: scanOptions.pathPreferences.filter((_, i) => i !== index)
    });
  };

  return (
    <div>
      {/* Controls */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={scanForDuplicates}
              disabled={isScanning}
              className="btn-primary flex items-center space-x-2"
            >
              {isScanning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>{isScanning ? 'Scanning...' : 'Scan for Duplicates'}</span>
            </button>
            
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="btn-secondary flex items-center space-x-2"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
              {showSettings ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>

          {duplicates.length > 0 && (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-zinc-400">
                {selectedDuplicates.size} of {duplicates.length} selected
              </span>
              <button
                onClick={selectAll}
                className="text-sm text-rekordbox-purple hover:text-purple-400"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="text-sm text-rekordbox-purple hover:text-purple-400"
              >
                Deselect All
              </button>
            </div>
          )}
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="border-t border-zinc-700 pt-4">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <h3 className="font-semibold mb-3">Detection Methods</h3>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={scanOptions.useFingerprint}
                      onChange={(e) => setScanOptions({
                        ...scanOptions,
                        useFingerprint: e.target.checked
                      })}
                      className="checkbox"
                    />
                    <span>Audio Fingerprinting (Most Accurate)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={scanOptions.useMetadata}
                      onChange={(e) => setScanOptions({
                        ...scanOptions,
                        useMetadata: e.target.checked
                      })}
                      className="checkbox"
                    />
                    <span>Metadata Matching</span>
                  </label>
                </div>

                {scanOptions.useMetadata && (
                  <div className="mt-3 ml-6 space-y-2">
                    <p className="text-sm text-zinc-400">Match by:</p>
                    {['artist', 'title', 'album', 'duration', 'bpm'].map(field => (
                      <label key={field} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={scanOptions.metadataFields.includes(field)}
                          onChange={(e) => {
                            const fields = e.target.checked
                              ? [...scanOptions.metadataFields, field]
                              : scanOptions.metadataFields.filter(f => f !== field);
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

              <div>
                <h3 className="font-semibold mb-3">Resolution Strategy</h3>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="strategy"
                      value="keep-highest-quality"
                      checked={resolutionStrategy === 'keep-highest-quality'}
                      onChange={(e) => setResolutionStrategy(e.target.value as any)}
                      className="text-rekordbox-purple"
                    />
                    <span>Keep Highest Quality</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="strategy"
                      value="keep-newest"
                      checked={resolutionStrategy === 'keep-newest'}
                      onChange={(e) => setResolutionStrategy(e.target.value as any)}
                      className="text-rekordbox-purple"
                    />
                    <span>Keep Newest</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="strategy"
                      value="keep-oldest"
                      checked={resolutionStrategy === 'keep-oldest'}
                      onChange={(e) => setResolutionStrategy(e.target.value as any)}
                      className="text-rekordbox-purple"
                    />
                    <span>Keep Oldest</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="strategy"
                      value="keep-preferred-path"
                      checked={resolutionStrategy === 'keep-preferred-path'}
                      onChange={(e) => setResolutionStrategy(e.target.value as any)}
                      className="text-rekordbox-purple"
                    />
                    <span>Keep Preferred Path</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="strategy"
                      value="manual"
                      checked={resolutionStrategy === 'manual'}
                      onChange={(e) => setResolutionStrategy(e.target.value as any)}
                      className="text-rekordbox-purple"
                    />
                    <span>Manual Selection</span>
                  </label>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Path Preferences</h3>
                <p className="text-sm text-zinc-400 mb-3">
                  Preferred paths/folders when using "Keep Preferred Path" strategy. Higher priority paths should be listed first.
                </p>
                
                <div className="flex space-x-2 mb-3">
                  <input
                    type="text"
                    value={pathPreferenceInput}
                    onChange={(e) => setPathPreferenceInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addPathPreference()}
                    placeholder="/Users/dj/Music"
                    className="flex-1 px-3 py-1 bg-zinc-800 border border-zinc-600 rounded text-sm"
                  />
                  <button
                    onClick={addPathPreference}
                    className="px-3 py-1 bg-rekordbox-purple hover:bg-purple-600 rounded text-sm"
                  >
                    Add
                  </button>
                </div>

                <div className="space-y-2">
                  {scanOptions.pathPreferences.map((path, index) => (
                    <div key={index} className="flex items-center justify-between bg-zinc-800 px-3 py-2 rounded">
                      <span className="text-sm text-zinc-300">{index + 1}. {path}</span>
                      <button
                        onClick={() => removePathPreference(index)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {scanOptions.pathPreferences.length === 0 && (
                    <div className="text-sm text-zinc-500 text-center py-2">
                      No path preferences set
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {duplicates.length > 0 && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Duplicate Sets Found</h2>
            <button
              onClick={resolveDuplicates}
              disabled={selectedDuplicates.size === 0}
              className="btn-primary flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Resolve Selected</span>
            </button>
          </div>

          <div className="space-y-4">
            {duplicates.map((duplicate) => (
              <DuplicateItem
                key={duplicate.id}
                duplicate={duplicate}
                isSelected={selectedDuplicates.has(duplicate.id)}
                onToggleSelection={() => toggleDuplicateSelection(duplicate.id)}
                resolutionStrategy={resolutionStrategy}
              />
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {!isScanning && duplicates.length === 0 && (
        <div className="card text-center py-12">
          <CheckCircle2 className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Duplicates Found</h3>
          <p className="text-zinc-400">
            Your library appears to be clean! Run a scan to check for duplicates.
          </p>
        </div>
      )}
    </div>
  );
};

export default DuplicateDetector;
