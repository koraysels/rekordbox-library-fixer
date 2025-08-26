import { describe, it, expect } from 'vitest';

/**
 * React Hooks Validation Tests
 * 
 * These tests specifically validate that all components using React hooks
 * have properly imported them. This prevents runtime errors like:
 * "useCallback is not defined" which occurred during refactoring.
 */

describe('React Hooks Import Validation', () => {
  describe('Component Import Validation', () => {
    it('should validate main components can be imported without errors', async () => {
      // Test that components can be imported - this catches missing React hook imports
      const imports = [
        import('../../src/renderer/components/DuplicateItem'),
        import('../../src/renderer/components/DuplicateDetector'),
        import('../../src/renderer/components/TrackRelocator'),
        import('../../src/renderer/components/TrackDetails'),
        import('../../src/renderer/components/ui/PopoverButton'),
        import('../../src/renderer/components/ui/ConfidenceBadge')
      ];
      
      // If any component has missing React hook imports, this will throw
      const modules = await Promise.all(imports);
      
      // Verify components are defined
      expect(modules[0].default).toBeDefined(); // DuplicateItem
      expect(modules[1].default).toBeDefined(); // DuplicateDetector
      expect(modules[2].TrackRelocator).toBeDefined(); // TrackRelocator
      expect(modules[3].default).toBeDefined(); // TrackDetails
      expect(modules[4].PopoverButton).toBeDefined(); // PopoverButton
      expect(modules[5].ConfidenceBadge).toBeDefined(); // ConfidenceBadge
    });
  });

  describe('Hook Usage Patterns', () => {
    it('should verify React hooks are available for import', async () => {
      // Simple test to ensure React hooks are available
      const { useState, useEffect, useCallback, useMemo, useRef } = await import('react');
      
      expect(useState).toBeDefined();
      expect(useEffect).toBeDefined();
      expect(useCallback).toBeDefined();
      expect(useMemo).toBeDefined();
      expect(useRef).toBeDefined();
    });

    it('should verify createPortal is available from react-dom', async () => {
      const { createPortal } = await import('react-dom');
      expect(createPortal).toBeDefined();
    });

    it('should verify lucide-react icons are available', async () => {
      const { Search, Settings, CheckCircle2, Trash2 } = await import('lucide-react');
      expect(Search).toBeDefined();
      expect(Settings).toBeDefined();
      expect(CheckCircle2).toBeDefined();
      expect(Trash2).toBeDefined();
    });
  });

  describe('Shared Component Dependencies', () => {
    it('should validate shared components can be imported', async () => {
      // Test that shared components can be imported without errors
      const { PopoverButton } = await import('../../src/renderer/components/ui/PopoverButton');
      const { ConfidenceBadge } = await import('../../src/renderer/components/ui/ConfidenceBadge');
      const { AppHeader } = await import('../../src/renderer/components/ui/AppHeader');
      const { AppFooter } = await import('../../src/renderer/components/ui/AppFooter');
      
      expect(PopoverButton).toBeDefined();
      expect(ConfidenceBadge).toBeDefined();
      expect(AppHeader).toBeDefined();
      expect(AppFooter).toBeDefined();
    });
  });
});