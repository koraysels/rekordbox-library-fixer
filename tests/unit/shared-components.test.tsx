import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Test all shared components can be imported and rendered
import { PopoverButton, ConfidenceBadge } from '../../src/renderer/components/ui';
import type { PopoverButtonProps, ConfidenceBadgeProps } from '../../src/renderer/components/ui';

// Test all utilities can be imported and used
import {
  formatFileSize,
  formatDuration,
  formatBitrate,
  formatRating,
  formatDate
} from '../../src/renderer/utils';

// Test all hooks can be imported
import { useFileOperations } from '../../src/renderer/hooks';

// Mock Lucide React icons
const MockIcon = () => <span data-testid="mock-icon">Icon</span>;

describe('Shared Components Integration', () => {
  describe('PopoverButton', () => {
    const defaultProps: PopoverButtonProps = {
      onClick: () => {},
      icon: MockIcon,
      title: 'Test Button',
      description: 'Test description',
      children: 'Click me'
    };

    it('should render without errors', () => {
      expect(() => {
        render(<PopoverButton {...defaultProps} />);
      }).not.toThrow();
    });

    it('should display the button text', () => {
      render(<PopoverButton {...defaultProps} />);
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('should handle click events', async () => {
      const handleClick = vitest.fn();
      const user = userEvent.setup();
      
      render(<PopoverButton {...defaultProps} onClick={handleClick} />);
      
      await user.click(screen.getByText('Click me'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should support different variants', () => {
      const variants: Array<'primary' | 'secondary' | 'danger' | 'success'> = [
        'primary', 'secondary', 'danger', 'success'
      ];

      variants.forEach(variant => {
        expect(() => {
          render(<PopoverButton {...defaultProps} variant={variant} />);
        }).not.toThrow();
      });
    });

    it('should show loading state', () => {
      render(<PopoverButton {...defaultProps} loading={true} />);
      // Should not throw and should render loading state
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('should handle disabled state', () => {
      render(<PopoverButton {...defaultProps} disabled={true} />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('ConfidenceBadge', () => {
    it('should render without errors', () => {
      expect(() => {
        render(<ConfidenceBadge confidence={95} />);
      }).not.toThrow();
    });

    it('should show "High" for confidence >= 90', () => {
      render(<ConfidenceBadge confidence={95} />);
      expect(screen.getByText('High')).toBeInTheDocument();
    });

    it('should show "Medium" for confidence between 70-89', () => {
      render(<ConfidenceBadge confidence={75} />);
      expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('should show "Low" for confidence < 70', () => {
      render(<ConfidenceBadge confidence={50} />);
      expect(screen.getByText('Low')).toBeInTheDocument();
    });

    it('should handle edge cases', () => {
      const testCases = [0, 69, 70, 89, 90, 100];
      
      testCases.forEach(confidence => {
        expect(() => {
          render(<ConfidenceBadge confidence={confidence} />);
        }).not.toThrow();
      });
    });
  });
});

describe('Shared Utilities', () => {
  describe('formatFileSize', () => {
    it('should format bytes to MB correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB'); // 1 MB
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB'); // 5 MB
      expect(formatFileSize(1536 * 1024)).toBe('1.5 MB'); // 1.5 MB
    });

    it('should handle undefined input', () => {
      expect(formatFileSize(undefined)).toBe('N/A');
    });

    it('should handle zero bytes', () => {
      expect(formatFileSize(0)).toBe('N/A');
    });

    it('should handle small file sizes', () => {
      expect(formatFileSize(512 * 1024)).toBe('0.5 MB');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds to MM:SS correctly', () => {
      expect(formatDuration(60)).toBe('1:00');
      expect(formatDuration(90)).toBe('1:30');
      expect(formatDuration(3661)).toBe('61:01'); // Over an hour
      expect(formatDuration(5)).toBe('0:05');
    });

    it('should handle undefined input', () => {
      expect(formatDuration(undefined)).toBe('N/A');
    });

    it('should handle zero duration', () => {
      expect(formatDuration(0)).toBe('N/A');
    });

    it('should pad seconds correctly', () => {
      expect(formatDuration(65)).toBe('1:05');
      expect(formatDuration(125)).toBe('2:05');
    });
  });

  describe('formatBitrate', () => {
    it('should format bitrate with kbps unit', () => {
      expect(formatBitrate(320)).toBe('320 kbps');
      expect(formatBitrate(128)).toBe('128 kbps');
    });

    it('should handle undefined input', () => {
      expect(formatBitrate(undefined)).toBe('N/A');
    });

    it('should handle zero bitrate', () => {
      expect(formatBitrate(0)).toBe('N/A');
    });
  });

  describe('formatRating', () => {
    it('should format rating out of 5', () => {
      expect(formatRating(5)).toBe('5/5');
      expect(formatRating(3)).toBe('3/5');
      expect(formatRating(0)).toBe('0/5');
    });

    it('should handle undefined input', () => {
      expect(formatRating(undefined)).toBe('0/5');
    });
  });

  describe('formatDate', () => {
    it('should format date correctly', () => {
      const testDate = new Date('2024-01-15');
      const formatted = formatDate(testDate);
      expect(formatted).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // MM/DD/YYYY or similar
    });

    it('should handle undefined input', () => {
      expect(formatDate(undefined)).toBe('N/A');
    });

    it('should handle invalid dates', () => {
      const invalidDate = new Date('invalid');
      expect(formatDate(invalidDate)).toBe('Invalid Date');
    });
  });
});

describe('Shared Hooks', () => {
  describe('useFileOperations', () => {
    it('should be importable without errors', () => {
      expect(useFileOperations).toBeDefined();
      expect(typeof useFileOperations).toBe('function');
    });

    // Note: We can't easily test the hook functionality in isolation
    // without mocking window.electronAPI, but at least we verify it imports correctly
  });
});

describe('TypeScript Interface Exports', () => {
  it('should export PopoverButtonProps interface', () => {
    // This test ensures the interface can be imported
    const props: PopoverButtonProps = {
      onClick: () => {},
      icon: MockIcon,
      title: 'Test',
      description: 'Test description',
      children: 'Test'
    };
    
    expect(props.onClick).toBeDefined();
    expect(props.icon).toBeDefined();
    expect(props.title).toBe('Test');
    expect(props.description).toBe('Test description');
  });

  it('should export ConfidenceBadgeProps interface', () => {
    const props: ConfidenceBadgeProps = {
      confidence: 85
    };
    
    expect(props.confidence).toBe(85);
  });
});

describe('Barrel Export Integration', () => {
  it('should export all UI components from barrel', () => {
    // Test that all expected exports are available
    expect(PopoverButton).toBeDefined();
    expect(ConfidenceBadge).toBeDefined();
  });

  it('should export all utilities from barrel', () => {
    expect(formatFileSize).toBeDefined();
    expect(formatDuration).toBeDefined();
    expect(formatBitrate).toBeDefined();
    expect(formatRating).toBeDefined();
    expect(formatDate).toBeDefined();
  });

  it('should export all hooks from barrel', () => {
    expect(useFileOperations).toBeDefined();
  });
});