import React, { useCallback, useEffect, useRef } from 'react';
import { FolderOpen, Plus, X } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import type { ScanOptions, ResolutionStrategy } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  scanOptions: ScanOptions;
  setScanOptions: (options: ScanOptions) => void;
  resolutionStrategy: ResolutionStrategy;
  setResolutionStrategy: (strategy: ResolutionStrategy) => void;
}

interface FormData {
  scanOptions: ScanOptions;
  resolutionStrategy: ResolutionStrategy;
  pathPreferenceInput: string;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  scanOptions,
  setScanOptions,
  resolutionStrategy,
  setResolutionStrategy
}) => {
  // React Hook Form for local state
  const { register, control, setValue, getValues } = useForm<FormData>({
    defaultValues: {
      scanOptions,
      resolutionStrategy,
      pathPreferenceInput: ''
    }
  });

  // Watch form changes for debounced sync
  const watchedScanOptions = useWatch({ control, name: 'scanOptions' });
  const watchedResolutionStrategy = useWatch({ control, name: 'resolutionStrategy' });
  const pathPreferenceInput = useWatch({ control, name: 'pathPreferenceInput' });

  // Debounced sync to Zustand store
  const debounceRef = useRef<NodeJS.Timeout>();

  const syncToStore = useCallback((scanOpts: ScanOptions, resStrategy: ResolutionStrategy) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setScanOptions(scanOpts);
      setResolutionStrategy(resStrategy);
    }, 500); // 500ms debounce
  }, [setScanOptions, setResolutionStrategy]);

  // Sync changes with debounce
  useEffect(() => {
    if (watchedScanOptions && watchedResolutionStrategy) {
      syncToStore(watchedScanOptions, watchedResolutionStrategy);
    }
  }, [watchedScanOptions, watchedResolutionStrategy, syncToStore]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Update form when external props change
  useEffect(() => {
    setValue('scanOptions', scanOptions);
    setValue('resolutionStrategy', resolutionStrategy);
  }, [scanOptions, resolutionStrategy, setValue]);

  // Handle folder browsing for path preferences
  const handleBrowseFolder = useCallback(async () => {
    try {
      const folderPath = await window.electronAPI.selectFolder();
      if (folderPath) {
        setValue('pathPreferenceInput', folderPath);
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  }, [setValue]);

  // Add path preference
  const addPathPreference = useCallback(() => {
    const currentScanOptions = getValues('scanOptions');
    const input = getValues('pathPreferenceInput');
    
    if (input.trim()) {
      const newPathPreferences = [...(currentScanOptions.pathPreferences || []), input.trim()];
      setValue('scanOptions.pathPreferences', newPathPreferences);
      setValue('pathPreferenceInput', '');
      
      // Immediate sync for actions like add/remove
      setScanOptions({
        ...currentScanOptions,
        pathPreferences: newPathPreferences
      });
    }
  }, [getValues, setValue, setScanOptions]);

  // Remove path preference  
  const removePathPreference = useCallback((index: number) => {
    const currentScanOptions = getValues('scanOptions');
    const newPathPreferences = (currentScanOptions.pathPreferences || []).filter((_, i) => i !== index);
    setValue('scanOptions.pathPreferences', newPathPreferences);
    
    // Immediate sync for actions like add/remove
    setScanOptions({
      ...currentScanOptions,
      pathPreferences: newPathPreferences
    });
  }, [getValues, setValue, setScanOptions]);


  // Update metadata fields
  const updateMetadataFields = useCallback((field: string, checked: boolean) => {
    const currentOptions = getValues('scanOptions');
    const fields = checked
      ? [...(currentOptions.metadataFields || []), field]
      : (currentOptions.metadataFields || []).filter(f => f !== field);
    setValue('scanOptions.metadataFields', fields);
  }, [getValues, setValue]);

  // Immediate sync for critical changes (blur handlers)
  const handleBlurSync = useCallback(() => {
    const currentScanOptions = getValues('scanOptions');
    const currentResolutionStrategy = getValues('resolutionStrategy');
    
    // Clear debounce and sync immediately
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setScanOptions(currentScanOptions);
    setResolutionStrategy(currentResolutionStrategy);
  }, [getValues, setScanOptions, setResolutionStrategy]);
  return (
    <div className="space-y-8">
          {/* Detection Methods */}
          <div>
            <h3 className="font-semibold mb-4 text-lg">Detection Methods</h3>
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  {...register('scanOptions.useFingerprint')}
                  onBlur={handleBlurSync}
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
                  {...register('scanOptions.useMetadata')}
                  onBlur={handleBlurSync}
                  className="checkbox"
                />
                <div>
                  <span className="font-medium">Metadata Matching</span>
                  <p className="text-sm text-zinc-400">Compare by track information</p>
                </div>
              </label>

              {watchedScanOptions?.useMetadata && (
                <div className="ml-8 space-y-2 mt-3">
                  <p className="text-sm text-zinc-400 mb-3">Match by:</p>
                  {['artist', 'title', 'album', 'duration', 'bpm'].map(field => (
                    <label key={field} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={(watchedScanOptions?.metadataFields || []).includes(field)}
                        onChange={(e) => updateMetadataFields(field, e.target.checked)}
                        onBlur={handleBlurSync}
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
                  value="keep-highest-quality"
                  {...register('resolutionStrategy')}
                  onBlur={handleBlurSync}
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
                  value="keep-newest"
                  {...register('resolutionStrategy')}
                  onBlur={handleBlurSync}
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
                  value="keep-oldest"
                  {...register('resolutionStrategy')}
                  onBlur={handleBlurSync}
                  className="mt-1 text-rekordbox-purple"
                />
                <div>
                  <span className="font-medium">Keep Oldest</span>
                  <p className="text-sm text-zinc-400">Keeps tracks that were added to library first</p>
                </div>
              </label>
              
              <label className={`flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                watchedResolutionStrategy === 'keep-preferred-path' 
                  ? 'border-rekordbox-purple bg-rekordbox-purple/10' 
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}>
                <input
                  type="radio"
                  value="keep-preferred-path"
                  {...register('resolutionStrategy')}
                  onBlur={handleBlurSync}
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
                  value="manual"
                  {...register('resolutionStrategy')}
                  onBlur={handleBlurSync}
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
                {...register('pathPreferenceInput')}
                onKeyPress={(e) => e.key === 'Enter' && addPathPreference()}
                onBlur={handleBlurSync}
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

            {(watchedScanOptions?.pathPreferences || []).length === 0 ? (
              <div className="text-center py-8 border border-dashed border-zinc-600 rounded-lg">
                <div className="text-4xl mb-2">📂</div>
                <p className="text-zinc-400 text-sm mb-1">No preferred paths set</p>
                <p className="text-zinc-500 text-xs">Add paths to prioritize when resolving duplicates</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(watchedScanOptions?.pathPreferences || []).map((path, index) => (
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