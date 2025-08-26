# Feature 3: Track Relocation & Repair - Scaffolding Plan

## Project Pattern Analysis

**File Naming Conventions:**
- React Components: PascalCase `.tsx` files
- TypeScript Modules: camelCase `.ts` files  
- UI Components: Stored in `src/renderer/components/ui/`
- Main Components: Stored in `src/renderer/components/`
- Main Process: Stored in `src/main/`
- Hooks: Prefixed with `use`, stored in `src/renderer/hooks/`

**Architecture Patterns:**
- Electron IPC communication with main/renderer separation
- React functional components with hooks
- Zustand store for state management
- TypeScript with strict typing
- Lucide React icons
- Tailwind CSS styling with custom rekordbox theme
- Error handling with try/catch and result objects

**Existing Integration Points:**
- Navigation tabs system supporting: 'duplicates' | 'import' | 'relocate' | 'maintenance'
- IPC API structure in preload.ts
- Settings store pattern
- Notification system
- Logger utility

## Feature 3 Implementation Plan

### Files to Create

#### 1. Main Process Files
- `src/main/trackRelocator.ts` - Core relocation logic
- `src/main/cloudSyncFixer.ts` - Cloud sync repair functionality  
- `src/main/trackOwnershipFixer.ts` - Fix grey tracks ownership

#### 2. Renderer Components
- `src/renderer/components/TrackRelocator.tsx` - Main relocation UI
- `src/renderer/components/CloudSyncManager.tsx` - Cloud sync management UI
- `src/renderer/hooks/useTrackRelocator.ts` - Relocation state management hook

#### 3. Type Definitions
- Add relocation types to `src/renderer/types/index.ts`

#### 4. IPC Integration
- Update `src/main/preload.ts` - Add relocation IPC channels
- Update `src/main/main.ts` - Add IPC handlers

#### 5. Dependencies
- Install required packages: `dropbox`, `fuzzy-search`, `glob`

## Implementation Order

1. **Create main process modules** - Core logic first
2. **Add type definitions** - TypeScript interfaces  
3. **Update IPC communication** - Main/renderer bridge
4. **Create React components** - UI implementation
5. **Create custom hook** - State management
6. **Integration testing** - Verify all pieces work together

## Component Structure Template

Based on existing patterns, components follow this structure:
```tsx
import React, { useState, useEffect } from 'react';
import { Icon1, Icon2 } from 'lucide-react';
import { useCustomHook } from '../hooks';
import type { ComponentProps } from '../types';

interface ComponentNameProps {
  // Props interface
}

const ComponentName: React.FC<ComponentNameProps> = ({ prop1, prop2 }) => {
  // State declarations
  // Custom hooks
  // useEffect hooks
  // Event handlers
  // Memoized values
  
  return (
    <div className="tailwind-classes">
      {/* JSX structure */}
    </div>
  );
};

export { ComponentName };
```

## IPC Pattern Template

Main process handlers follow this pattern:
```typescript
ipcMain.handle('channel-name', async (_, args) => {
  safeConsole.log(`🔧 IPC: Operation description`);
  try {
    const result = await operationFunction(args);
    safeConsole.log(`✅ Operation successful`);
    return { success: true, data: result };
  } catch (error) {
    safeConsole.error('❌ Operation failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
});
```

## Styling Conventions

- Uses Tailwind CSS with custom rekordbox theme
- Dark theme primary: `bg-rekordbox-dark`
- Purple accents: `text-rekordbox-purple`, `border-rekordbox-purple`
- Cards: `bg-gray-800 rounded-lg border border-gray-700`
- Buttons: Consistent with existing button patterns
- Loading states: `Loader2` icon with spinning animation

## State Management Pattern

- Global state: Zustand store (if needed)
- Component state: React useState
- Async operations: Custom hooks with loading/error states
- Persistent data: SQLite database via main process

## Error Handling Pattern

- All async operations wrapped in try/catch
- Consistent error result format: `{ success: boolean, error?: string }`
- User notifications via notification system
- Logging via logger utility in main process
- Safe console logging to prevent EPIPE errors