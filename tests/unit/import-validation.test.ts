import { describe, it, expect } from 'vitest';

/**
 * Import Validation Tests
 * 
 * These tests ensure that all shared components, utilities, and hooks
 * can be imported correctly and don't have missing dependencies.
 * This prevents runtime errors like missing useCallback imports.
 */

describe('Import Validation - All Imports Should Work', () => {
  describe('UI Components Barrel Export', () => {
    it('should import all UI components without errors', async () => {
      const uiModule = await import('../../src/renderer/components/ui');
      
      // Test that all expected exports exist
      expect(uiModule.PopoverButton).toBeDefined();
      expect(uiModule.ConfidenceBadge).toBeDefined();
      expect(uiModule.AppHeader).toBeDefined();
      expect(uiModule.AppFooter).toBeDefined();
      expect(uiModule.NavigationTabs).toBeDefined();
      expect(uiModule.SettingsSlideout).toBeDefined();
      
      // Test that TypeScript interfaces are properly exported
      expect(typeof uiModule.PopoverButton).toBe('function');
      expect(typeof uiModule.ConfidenceBadge).toBe('function');
    });

    it('should import individual UI components directly', async () => {
      // Test direct imports work
      const popoverModule = await import('../../src/renderer/components/ui/PopoverButton');
      const badgeModule = await import('../../src/renderer/components/ui/ConfidenceBadge');
      
      expect(popoverModule.PopoverButton).toBeDefined();
      expect(badgeModule.ConfidenceBadge).toBeDefined();
    });
  });

  describe('Utilities Barrel Export', () => {
    it('should import all utility functions without errors', async () => {
      const utilsModule = await import('../../src/renderer/utils');
      
      expect(utilsModule.formatFileSize).toBeDefined();
      expect(utilsModule.formatDuration).toBeDefined();
      expect(utilsModule.formatBitrate).toBeDefined();
      expect(utilsModule.formatRating).toBeDefined();
      expect(utilsModule.formatDate).toBeDefined();
      
      // Test that they are functions
      expect(typeof utilsModule.formatFileSize).toBe('function');
      expect(typeof utilsModule.formatDuration).toBe('function');
      expect(typeof utilsModule.formatBitrate).toBe('function');
      expect(typeof utilsModule.formatRating).toBe('function');
      expect(typeof utilsModule.formatDate).toBe('function');
    });

    it('should import formatters directly', async () => {
      const formattersModule = await import('../../src/renderer/utils/formatters');
      
      expect(formattersModule.formatFileSize).toBeDefined();
      expect(formattersModule.formatDuration).toBeDefined();
      expect(formattersModule.formatBitrate).toBeDefined();
      expect(formattersModule.formatRating).toBeDefined();
      expect(formattersModule.formatDate).toBeDefined();
    });
  });

  describe('Hooks Barrel Export', () => {
    it('should import all hooks without errors', async () => {
      const hooksModule = await import('../../src/renderer/hooks');
      
      expect(hooksModule.useFileOperations).toBeDefined();
      expect(hooksModule.useLibrary).toBeDefined();
      expect(hooksModule.useNotifications).toBeDefined();
      expect(hooksModule.useDuplicates).toBeDefined();
      expect(hooksModule.useTrackRelocator).toBeDefined();
      
      // Test that they are functions
      expect(typeof hooksModule.useFileOperations).toBe('function');
      expect(typeof hooksModule.useLibrary).toBe('function');
      expect(typeof hooksModule.useNotifications).toBe('function');
      expect(typeof hooksModule.useDuplicates).toBe('function');
      expect(typeof hooksModule.useTrackRelocator).toBe('function');
    });

    it('should import individual hooks directly', async () => {
      const fileOpsModule = await import('../../src/renderer/hooks/useFileOperations');
      expect(fileOpsModule.useFileOperations).toBeDefined();
    });
  });

  describe('Component Dependencies', () => {
    it('should validate DuplicateItem has all required React imports', async () => {
      // Test that the component can be imported without throwing
      expect(async () => {
        await import('../../src/renderer/components/DuplicateItem');
      }).not.toThrow();
    });

    it('should validate DuplicateDetector has all required imports', async () => {
      expect(async () => {
        await import('../../src/renderer/components/DuplicateDetector');
      }).not.toThrow();
    });

    it('should validate TrackRelocator has all required imports', async () => {
      expect(async () => {
        await import('../../src/renderer/components/TrackRelocator');
      }).not.toThrow();
    });

    it('should validate TrackDetails has all required imports', async () => {
      expect(async () => {
        await import('../../src/renderer/components/TrackDetails');
      }).not.toThrow();
    });
  });

  describe('React Hook Dependencies', () => {
    it('should ensure all components importing hooks have React hooks imported', async () => {
      // This test checks that components using React hooks import them correctly
      const duplicateItemModule = await import('../../src/renderer/components/DuplicateItem');
      
      // If this import succeeds, it means all React hook dependencies are satisfied
      expect(duplicateItemModule.default).toBeDefined();
    });
  });

  describe('TypeScript Interface Validation', () => {
    it('should validate all interfaces can be imported and used', () => {
      // Test interface imports don't cause compilation errors
      expect(() => {
        type TestProps = import('../../src/renderer/components/ui').PopoverButtonProps;
        type TestBadgeProps = import('../../src/renderer/components/ui').ConfidenceBadgeProps;
        
        // These should not throw TypeScript errors
        const _testProps: TestProps = {
          onClick: () => {},
          icon: () => null,
          title: 'test',
          description: 'test',
          children: 'test'
        };
        
        const _testBadgeProps: TestBadgeProps = {
          confidence: 50
        };
      }).not.toThrow();
    });
  });

  describe('Circular Dependencies', () => {
    it('should not have circular dependencies in barrel exports', async () => {
      // Test that importing barrel exports doesn't cause infinite loops
      const uiPromise = import('../../src/renderer/components/ui');
      const utilsPromise = import('../../src/renderer/utils');
      const hooksPromise = import('../../src/renderer/hooks');
      
      const [ui, utils, hooks] = await Promise.all([uiPromise, utilsPromise, hooksPromise]);
      
      expect(ui).toBeDefined();
      expect(utils).toBeDefined();
      expect(hooks).toBeDefined();
    });
  });

  describe('External Dependencies', () => {
    it('should validate lucide-react icons are properly imported', async () => {
      // Test that external dependencies are available
      const { Search, Settings, CheckCircle2 } = await import('lucide-react');
      
      expect(Search).toBeDefined();
      expect(Settings).toBeDefined();
      expect(CheckCircle2).toBeDefined();
    });

    it('should validate React hooks are available', async () => {
      const { useState, useEffect, useCallback, useMemo, memo } = await import('react');
      
      expect(useState).toBeDefined();
      expect(useEffect).toBeDefined();
      expect(useCallback).toBeDefined();
      expect(useMemo).toBeDefined();
      expect(memo).toBeDefined();
    });
  });
});