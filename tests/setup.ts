import { beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock fs for tests that don't need real file access
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      access: vi.fn(),
      stat: vi.fn(),
      open: vi.fn(),
    },
  };
});

// Mock Electron app for logger
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/test-logs'),
  },
}));

// Mock crypto for consistent test results
vi.mock('crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'mocked-hash'),
  })),
  randomBytes: vi.fn(() => Buffer.from('mockedhex')),
}));

// Mock music-metadata for tests
vi.mock('music-metadata', () => ({
  parseFile: vi.fn(() => Promise.resolve({
    format: {
      duration: 240.5,
      bitrate: 320,
    },
  })),
}));

// Helper to get test fixture path
export const getFixturePath = (filename: string): string => {
  return path.join(__dirname, 'fixtures', filename);
};

// Helper to load test fixture content
export const loadFixture = (filename: string): string => {
  return fs.readFileSync(getFixturePath(filename), 'utf-8');
};

beforeEach(() => {
  vi.clearAllMocks();
});