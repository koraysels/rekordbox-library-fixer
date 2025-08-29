import React, { useCallback, useEffect, useRef } from 'react';
import { FolderOpen, Plus, X } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import type { ScanOptions, ResolutionStrategy } from '../types';

interface SettingsPanelProps {
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
    <div className="space-y-8 p-6">
          {/* Detection Methods */}
          <div>
            <h3 className="font-te-display font-semibold mb-4 text-lg text-te-grey-800 uppercase tracking-te-display">Detection Methods</h3>
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  {...register('scanOptions.useFingerprint')}
                  onBlur={handleBlurSync}
                  className="checkbox"
                />
                <div>
                  <span className="font-medium text-te-grey-800">Audio Fingerprinting</span>
                  <p className="text-sm text-te-grey-600 font-te-mono">Most accurate detection method</p>
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
                  <span className="font-medium text-te-grey-800">Metadata Matching</span>
                  <p className="text-sm text-te-grey-600 font-te-mono">Compare by track information</p>
                </div>
              </label>

              {watchedScanOptions?.useMetadata && (
                <div className="ml-8 space-y-2 mt-3 p-4 bg-te-grey-100 rounded-te border-2 border-te-grey-300">
                  <p className="text-sm text-te-grey-600 mb-3 font-te-mono">Match by:</p>
                  {['artist', 'title', 'album', 'duration', 'bpm'].map(field => (
                    <label key={field} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={(watchedScanOptions?.metadataFields || []).includes(field)}
                        onChange={(e) => updateMetadataFields(field, e.target.checked)}
                        onBlur={handleBlurSync}
                        className="checkbox"
                      />
                      <span className="capitalize text-sm text-te-grey-700 font-te-mono">{field}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Resolution Strategy */}
          <div>
            <h3 className="font-te-display font-semibold mb-4 text-lg text-te-grey-800 uppercase tracking-te-display">Resolution Strategy</h3>
            <div className="space-y-3">
              <label className="flex items-start space-x-3 p-4 rounded-lg border-2 border-te-grey-300 hover:border-te-orange bg-te-cream cursor-pointer transition-colors">
                <input
                  type="radio"
                  value="keep-highest-quality"
                  {...register('resolutionStrategy')}
                  onBlur={handleBlurSync}
                  className="mt-1 text-te-orange"
                />
                <div>
                  <span className="font-medium text-te-grey-800">Keep Highest Quality</span>
                  <p className="text-sm text-te-grey-600 font-te-mono">Keeps tracks with higher bitrate and file size</p>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-4 rounded-lg border-2 border-te-grey-300 hover:border-te-orange bg-te-cream cursor-pointer transition-colors">
                <input
                  type="radio"
                  value="keep-newest"
                  {...register('resolutionStrategy')}
                  onBlur={handleBlurSync}
                  className="mt-1 text-te-orange"
                />
                <div>
                  <span className="font-medium text-te-grey-800">Keep Newest</span>
                  <p className="text-sm text-te-grey-600 font-te-mono">Keeps tracks with most recent modification date</p>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-4 rounded-lg border-2 border-te-grey-300 hover:border-te-orange bg-te-cream cursor-pointer transition-colors">
                <input
                  type="radio"
                  value="keep-oldest"
                  {...register('resolutionStrategy')}
                  onBlur={handleBlurSync}
                  className="mt-1 text-te-orange"
                />
                <div>
                  <span className="font-medium text-te-grey-800">Keep Oldest</span>
                  <p className="text-sm text-te-grey-600 font-te-mono">Keeps tracks that were added to library first</p>
                </div>
              </label>

              <label className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                watchedResolutionStrategy === 'keep-preferred-path'
                  ? 'border-te-orange bg-te-orange/10'
                  : 'border-te-grey-300 bg-te-cream hover:border-te-orange'
              }`}>
                <input
                  type="radio"
                  value="keep-preferred-path"
                  {...register('resolutionStrategy')}
                  onBlur={handleBlurSync}
                  className="mt-1 text-te-orange"
                />
                <div>
                  <span className="font-medium text-te-grey-800">Keep Preferred Path</span>
                  <p className="text-sm text-te-grey-600 font-te-mono">Keeps tracks from your preferred folders/locations</p>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-4 rounded-lg border-2 border-te-grey-300 hover:border-te-orange bg-te-cream cursor-pointer transition-colors">
                <input
                  type="radio"
                  value="manual"
                  {...register('resolutionStrategy')}
                  onBlur={handleBlurSync}
                  className="mt-1 text-te-orange"
                />
                <div>
                  <span className="font-medium text-te-grey-800">Manual Selection</span>
                  <p className="text-sm text-te-grey-600 font-te-mono">Let you choose which track to keep for each duplicate</p>
                </div>
              </label>
            </div>
          </div>

          {/* Path Preferences */}
          <div>
            <h3 className="font-te-display font-semibold mb-4 text-lg text-te-grey-800 uppercase tracking-te-display">Path Preferences</h3>
            <p className="text-sm text-te-grey-600 mb-4 font-te-mono">
              Preferred paths/folders when using "Keep Preferred Path" strategy. Higher priority paths should be listed first.
            </p>

            <div className="flex space-x-2 mb-4">
              <input
                type="text"
                {...register('pathPreferenceInput')}
                onKeyPress={(e) => e.key === 'Enter' && addPathPreference()}
                onBlur={handleBlurSync}
                placeholder="e.g., /Users/DJ/Main Library"
                className="flex-1 px-3 py-2 bg-te-cream border-2 border-te-grey-300 rounded-te text-te-grey-800 placeholder:text-te-grey-400 focus:border-te-orange focus:outline-none font-te-mono"
              />
              <button
                onClick={handleBrowseFolder}
                className="px-3 py-2 bg-te-grey-200 hover:bg-te-grey-300 text-te-grey-700 rounded-te border-2 border-te-grey-400 transition-colors flex items-center"
                title="Browse for folder"
              >
                <FolderOpen size={16} />
              </button>
              <button
                onClick={addPathPreference}
                disabled={!pathPreferenceInput.trim()}
                className="px-4 py-2 bg-te-orange hover:bg-te-orange/90 disabled:bg-te-grey-300 disabled:text-te-grey-500 text-te-cream rounded-te border-2 border-te-orange disabled:border-te-grey-400 transition-colors flex items-center space-x-1 font-te-mono"
              >
                <Plus size={16} />
                <span>Add</span>
              </button>
            </div>

            {(watchedScanOptions?.pathPreferences || []).length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-te-grey-400 rounded-te bg-te-grey-100">
                <div className="text-4xl mb-2">📂</div>
                <p className="text-te-grey-600 text-sm mb-1 font-te-mono">No preferred paths set</p>
                <p className="text-te-grey-500 text-xs font-te-mono">Add paths to prioritize when resolving duplicates</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(watchedScanOptions?.pathPreferences || []).map((path, index) => (
                  <div key={index} className="flex items-center justify-between bg-te-cream px-3 py-3 rounded-te border-2 border-te-grey-300">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <span className="text-te-orange font-semibold text-sm font-te-display">#{index + 1}</span>
                      <span className="font-te-mono text-sm text-te-grey-700 truncate">{path}</span>
                    </div>
                    <button
                      onClick={() => removePathPreference(index)}
                      className="text-te-red-500 hover:text-te-red-600 hover:bg-te-red-100 px-2 py-1 rounded-te ml-2 transition-colors"
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
