# Refactor Plan - Persistent Results with SQLite + TanStack Query

**Created:** 2025-01-26  
**Status:** Planning  

## Initial State Analysis

### Current Architecture
- **Duplicate Detection**: Has SQLite persistence via `DuplicateStorage` but lacks proper loading/hydration
- **Track Relocator**: No persistence - all state lost on component unmount  
- **State Management**: Manual React state + Zustand for settings
- **Data Layer**: Basic SQLite with `better-sqlite3`, missing TanStack Query integration

### Problem Areas
1. **Missing Data Hydration**: Duplicate results aren't loaded when library is re-selected
2. **No Track Relocator Persistence**: Missing tracks, relocations, cloud sync, ownership issues are lost
3. **Manual State Management**: No proper caching, optimistic updates, or background sync
4. **Inconsistent Patterns**: Duplicate detection has partial persistence, track relocator has none

### Dependencies
- ✅ `better-sqlite3` - SQLite database 
- ✅ `@tanstack/react-virtual` - Virtualization (already installed)
- ❌ `@tanstack/db` - Type-safe SQL database solution (needs installation)

### Test Coverage
- Unit tests exist for components
- E2E tests with Playwright
- Need to maintain 100% functional compatibility

## Refactoring Tasks

### Phase 1: Infrastructure Setup ✅ HIGH PRIORITY
- [ ] **Task 1.1**: Install `@tanstack/db` and related dependencies
- [ ] **Task 1.2**: Create TanStack DB schema and client setup
- [ ] **Task 1.3**: Create unified `PersistenceManager` class with TanStack DB

### Phase 2: Track Relocator Persistence 🔴 CRITICAL  
- [ ] **Task 2.1**: Create `TrackRelocatorStorage` class (mirror of `DuplicateStorage`)
- [ ] **Task 2.2**: Design SQLite schema for track relocator data:
  - Missing tracks table
  - Relocation mappings table  
  - Cloud sync issues table
  - Ownership issues table
  - Search options table
- [ ] **Task 2.3**: Add IPC handlers for track relocator persistence
- [ ] **Task 2.4**: Update preload script with new track relocator persistence APIs

### Phase 3: TanStack DB Integration ✅ HIGH PRIORITY  
- [ ] **Task 3.1**: Create TanStack DB hooks for duplicate detection:
  - `useDuplicateResults` - Type-safe duplicate scan operations
  - `useDuplicateScanning` - Handle scanning state with DB persistence
- [ ] **Task 3.2**: Create TanStack DB hooks for track relocator:
  - `useMissingTracks` - Type-safe missing tracks operations
  - `useRelocationResults` - Handle relocation mappings with DB
  - `useCloudSyncIssues` - Manage cloud sync issues
  - `useOwnershipIssues` - Handle ownership problems
- [ ] **Task 3.3**: Implement proper type-safe queries per library

### Phase 4: Enhanced Duplicate Detection ⚡ MEDIUM PRIORITY
- [ ] **Task 4.1**: Fix missing data hydration in `useDuplicates` hook
- [ ] **Task 4.2**: Replace manual saving with TanStack DB operations
- [ ] **Task 4.3**: Add type-safe operations for scan results
- [ ] **Task 4.4**: Implement proper loading states and error handling

### Phase 5: Unified State Management 🔄 MEDIUM PRIORITY  
- [ ] **Task 5.1**: Create `useLibraryResults` hook to manage all per-library data
- [ ] **Task 5.2**: Implement automatic cache cleanup when library changes
- [ ] **Task 5.3**: Add background sync and conflict resolution
- [ ] **Task 5.4**: Create unified loading/error states across all features

### Phase 6: Performance & UX Enhancements ⚡ LOW PRIORITY
- [ ] **Task 6.1**: Implement intelligent prefetching of library data
- [ ] **Task 6.2**: Add optimistic updates for all mutations
- [ ] **Task 6.3**: Create unified progress indicators  
- [ ] **Task 6.4**: Add data export/import functionality

## Implementation Strategy

### Risk Mitigation
1. **Backwards Compatibility**: Maintain existing API surface while adding new persistence
2. **Incremental Migration**: Keep existing hooks working while building new query-based ones
3. **Data Migration**: Ensure existing duplicate results migrate to new schema if needed  
4. **Fallback Mechanism**: Graceful degradation if SQLite operations fail

### Architecture Principles
- **Per-Library Isolation**: All data keyed by library path for clean separation
- **Optimistic Updates**: Immediate UI feedback with background persistence
- **Cache Management**: Automatic invalidation and cleanup strategies
- **Error Boundaries**: Robust error handling with user-friendly messages

## Validation Checklist

### Functional Requirements
- [ ] Duplicate scan results persist across app restarts
- [ ] Track relocator results persist across component unmounts  
- [ ] All data properly isolated per library path
- [ ] No data loss during library switching
- [ ] Background saving works without blocking UI

### Technical Requirements  
- [ ] All existing tests passing
- [ ] New persistence layers have unit tests
- [ ] TanStack Query integration properly configured
- [ ] SQLite schemas handle data migrations
- [ ] Performance benchmarks maintained or improved

### User Experience
- [ ] Loading states are consistent and informative
- [ ] No perceived performance regression
- [ ] Error messages are actionable
- [ ] Data loads instantly when returning to library
- [ ] Progress indicators work correctly

## De-Para Mapping

| Before | After | Status |
|--------|-------|--------|
| `useDuplicates` manual save | TanStack Query mutations | Pending |
| No track relocator persistence | `TrackRelocatorStorage` + React Query | Pending |  
| Manual state in `useTrackRelocator` | Query-based state management | Pending |
| Inconsistent loading patterns | Unified `useLibraryResults` hook | Pending |
| Manual cache management | Automatic cache invalidation | Pending |

## Breaking Changes
- **None Expected**: All existing component APIs will remain unchanged
- **Internal Only**: Changes are isolated to hooks and persistence layer
- **Migration**: Automatic migration of existing duplicate results data

## Success Metrics
- **Data Persistence**: 100% of results survive app restarts and library switches
- **Performance**: No degradation in scan/operation speeds  
- **Reliability**: Zero data loss incidents
- **UX**: Improved perceived performance with instant data loading
- **Code Quality**: Reduced complexity in state management logic