import {useState, useCallback, useMemo, useRef, useEffect} from 'react';
import {useSettingsStore} from '../stores/settingsStore';
import {duplicateStorage} from '../db/duplicatesDb';
import type {DuplicateItem} from '../types';

export const useDuplicates = (
    libraryPath: string) => {
    // Non-persistent state (stays in React state)
    const [duplicates, setDuplicates] = useState<DuplicateItem[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [hasScanned, setHasScanned] = useState(false);
    const [selectedDuplicates, setSelectedDuplicates] = useState<Set<string>>(new Set());
    const [currentLibraryPath, setCurrentLibraryPath] = useState<string>('');
    const [displayLimit, setDisplayLimit] = useState(50);
    const [searchFilter, setSearchFilter] = useState<string>('');
    const [debouncedSearchFilter, setDebouncedSearchFilter] = useState<string>('');
    const [isSearching, setIsSearching] = useState(false);

    // Persistent settings from Zustand store - individual selectors for optimal re-renders
    const scanOptions = useSettingsStore((state) => state.scanOptions);
    const resolutionStrategy = useSettingsStore((state) => state.resolutionStrategy);
    const setScanOptions = useSettingsStore((state) => state.setScanOptions);
    const setResolutionStrategy = useSettingsStore((state) => state.setResolutionStrategy);

    // Debounced save reference
    const debouncedSaveRef = useRef<NodeJS.Timeout>();
    const debouncedSearchRef = useRef<NodeJS.Timeout>();

    // Debounce search filter to improve performance
    useEffect(() => {
        if (debouncedSearchRef.current) {
            clearTimeout(debouncedSearchRef.current);
        }

        // Show loading if there's a search term and it's different from debounced
        setIsSearching(searchFilter !== debouncedSearchFilter && searchFilter.trim() !== '');

        debouncedSearchRef.current = setTimeout(() => {
            setDebouncedSearchFilter(searchFilter);
            setIsSearching(false);
        }, 300); // 300ms debounce delay

        return () => {
            if (debouncedSearchRef.current) {
                clearTimeout(debouncedSearchRef.current);
            }
        };
    }, [searchFilter, debouncedSearchFilter]);

    // Zustand handles persistence automatically - no manual localStorage needed!

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

    // Filtered duplicates based on debounced search
    const filteredDuplicates = useMemo(() => {
        if (!debouncedSearchFilter.trim()) return duplicates;

        const filter = debouncedSearchFilter.toLowerCase();
        return duplicates.filter(duplicate =>
            duplicate.tracks.some(track =>
                track.name?.toLowerCase().includes(filter) ||
                track.artist?.toLowerCase().includes(filter) ||
                track.album?.toLowerCase().includes(filter) ||
                track.location?.toLowerCase().includes(filter)
            )
        );
    }, [duplicates, debouncedSearchFilter]);

    // Virtualized list helpers
    const visibleDuplicates = useMemo(() => {
        return filteredDuplicates.slice(0, displayLimit);
    }, [filteredDuplicates, displayLimit]);

    const hasMoreDuplicates = useMemo(() => {
        return filteredDuplicates.length > displayLimit;
    }, [filteredDuplicates.length, displayLimit]);

    const loadMoreDuplicates = useCallback(() => {
        setDisplayLimit(prev => Math.min(prev + 50, filteredDuplicates.length));
    }, [filteredDuplicates.length]);

    // Memoized duplicate items with pathPreferences
    const memoizedVisibleDuplicates = useMemo(() => {
        return visibleDuplicates.map(duplicate => ({
            ...duplicate,
            pathPreferences: scanOptions.pathPreferences
        }));
    }, [visibleDuplicates, scanOptions.pathPreferences]);

    // Debounced save function using Dexie
    const saveDuplicateResults = useCallback(async () => {
        if (!libraryPath) return;

        // Clear existing timeout
        if (debouncedSaveRef.current) {
            clearTimeout(debouncedSaveRef.current);
        }

        // Debounce saves by 1 second
        debouncedSaveRef.current = setTimeout(async () => {
            try {
                console.log(`💾 Saving duplicate results to Dexie: ${duplicates.length} duplicates, ${selectedDuplicates.size} selected`);
                await duplicateStorage.saveDuplicateResult({
                    libraryPath,
                    duplicates,
                    selectedDuplicates: Array.from(selectedDuplicates),
                    hasScanned,
                    scanOptions
                });
                console.log('✅ Successfully saved to Dexie');
            } catch (error) {
                console.error('❌ Error saving duplicate results to Dexie:', error);
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
        searchFilter,
        setSearchFilter,
        isSearching,
        filteredDuplicates,
        visibleDuplicates,
        hasMoreDuplicates,
        loadMoreDuplicates,
        memoizedVisibleDuplicates,
        saveDuplicateResults
    };
};
