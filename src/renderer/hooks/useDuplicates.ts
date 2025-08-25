import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { DuplicateItem, ScanOptions, ResolutionStrategy, NotificationType, LibraryData } from '../types';

export const useDuplicates = (
  libraryPath: string,
  showNotification: (type: NotificationType, message: string) => void
) => {
  const [duplicates, setDuplicates] = useState<DuplicateItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<string>>(new Set());
  const [scanOptions, setScanOptions] = useState<ScanOptions>({
    useFingerprint: true,
    useMetadata: false,
    metadataFields: ['artist', 'title', 'duration'],
    pathPreferences: []
  });
  const [resolutionStrategy, setResolutionStrategy] = useState<ResolutionStrategy>('keep-highest-quality');
  const [currentLibraryPath, setCurrentLibraryPath] = useState<string>('');
  const [displayLimit, setDisplayLimit] = useState(50);
  
  // Debounced save reference
  const debouncedSaveRef = useRef<NodeJS.Timeout>();

  // Toggle duplicate selection
  const toggleDuplicateSelection = useCallback((id: string) => {
    setSelectedDuplicates(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
      console.log(`🔘 Toggle selection for ${id}, new count: ${newSelection.size}`);
      return newSelection;
    });
  }, []);

  // Select all duplicates
  const selectAll = useCallback(() => {
    setSelectedDuplicates(new Set(duplicates.map(d => d.id)));
  }, [duplicates]);

  // Clear all selections
  const clearAll = useCallback(() => {
    setSelectedDuplicates(new Set());
  }, []);

  // Set selections directly (for loading from storage)
  const setSelections = useCallback((selections: Set<string> | string[]) => {
    if (Array.isArray(selections)) {
      setSelectedDuplicates(new Set(selections));
    } else {
      setSelectedDuplicates(new Set(selections));
    }
  }, []);

  // Memoized calculations
  const selectedCount = useMemo(() => selectedDuplicates.size, [selectedDuplicates.size]);
  const totalDuplicateCount = useMemo(() => duplicates.length, [duplicates.length]);
  const isResolveDisabled = useMemo(() => selectedCount === 0 || isScanning, [selectedCount, isScanning]);
  
  // Virtualized list helpers
  const visibleDuplicates = useMemo(() => {
    return duplicates.slice(0, displayLimit);
  }, [duplicates, displayLimit]);
  
  const hasMoreDuplicates = useMemo(() => {
    return duplicates.length > displayLimit;
  }, [duplicates.length, displayLimit]);

  const loadMoreDuplicates = useCallback(() => {
    setDisplayLimit(prev => Math.min(prev + 50, duplicates.length));
  }, [duplicates.length]);

  // Memoized duplicate items with pathPreferences
  const memoizedVisibleDuplicates = useMemo(() => {
    return visibleDuplicates.map(duplicate => ({
      ...duplicate,
      pathPreferences: scanOptions.pathPreferences
    }));
  }, [visibleDuplicates, scanOptions.pathPreferences]);

  // Debounced save function
  const saveDuplicateResults = useCallback(async () => {
    if (!libraryPath) return;
    
    // Clear existing timeout
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current);
    }
    
    // Debounce saves by 1 second
    debouncedSaveRef.current = setTimeout(async () => {
      try {
        console.log(`💾 Saving duplicate results to SQLite: ${duplicates.length} duplicates, ${selectedDuplicates.size} selected`);
        const result = await window.electronAPI.saveDuplicateResults({
          libraryPath,
          duplicates,
          selectedDuplicates: Array.from(selectedDuplicates),
          hasScanned,
          scanOptions
        });
        
        if (!result.success) {
          console.error('❌ Failed to save duplicate results:', result.error);
        }
      } catch (error) {
        console.error('❌ Error saving duplicate results:', error);
      }
    }, 1000);
  }, [libraryPath, duplicates, selectedDuplicates, hasScanned, scanOptions]);

  // Auto-save when relevant data changes
  useEffect(() => {
    if (libraryPath && hasScanned) {
      saveDuplicateResults();
    }
  }, [saveDuplicateResults, libraryPath, hasScanned]);

  return {
    duplicates,
    setDuplicates,
    isScanning,
    setIsScanning,
    hasScanned,
    setHasScanned,
    selectedDuplicates,
    scanOptions,
    setScanOptions,
    resolutionStrategy,
    setResolutionStrategy,
    currentLibraryPath,
    setCurrentLibraryPath,
    displayLimit,
    setDisplayLimit,
    toggleDuplicateSelection,
    selectAll,
    clearAll,
    setSelections,
    selectedCount,
    totalDuplicateCount,
    isResolveDisabled,
    visibleDuplicates,
    hasMoreDuplicates,
    loadMoreDuplicates,
    memoizedVisibleDuplicates,
    saveDuplicateResults
  };
};