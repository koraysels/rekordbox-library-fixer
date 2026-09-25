import { describe, it, expect } from 'vitest';
import {
  platformFromUserAgent, keyCommandFor, looksLikeDbKey,
} from '../../src/renderer/utils/keyExtractionCommand';

describe('platformFromUserAgent', () => {
  it.each([
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'windows'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'macos'],
    ['Mozilla/5.0 (X11; Linux x86_64)', 'linux'],
    ['', 'linux'],
  ])('%s -> %s', (agent, expected) => {
    expect(platformFromUserAgent(agent)).toBe(expected);
  });
});

describe('keyCommandFor', () => {
  it('gives a PowerShell command on Windows', () => {
    const { shell, command } = keyCommandFor('windows');
    expect(shell).toBe('PowerShell');
    expect(command).toContain('py -m pip install');
    // PowerShell has no &&; the statement separator is a semicolon.
    expect(command).not.toContain('&&');
  });

  it('gives a shell command on macOS and Linux', () => {
    for (const platform of ['macos', 'linux'] as const) {
      const { command } = keyCommandFor(platform);
      expect(command).toContain('python3 -m pip install');
      expect(command).toContain('&&');
    }
  });

  it('asks pyrekordbox for the key rather than carrying one', () => {
    // The app must never ship the key; the command produces it locally from a
    // package the user can read.
    const { command } = keyCommandFor('macos');
    expect(command).toContain('pyrekordbox');
    expect(command).toContain('deobfuscate(BLOB)');
    expect(command).not.toMatch(/[0-9a-f]{32}/i);
  });

  it('quotes the python one-liner as one argument', () => {
    const { command } = keyCommandFor('macos');
    expect(command.match(/"/g)).toHaveLength(2);
    expect(command).not.toContain("'");
  });
});

describe('looksLikeDbKey', () => {
  it('accepts 64 hex characters', () => {
    expect(looksLikeDbKey('a'.repeat(64))).toBe(true);
    expect(looksLikeDbKey(`  ${'0123456789abcdef'.repeat(4)}  `)).toBe(true);
  });

  it('rejects anything else', () => {
    expect(looksLikeDbKey('')).toBe(false);
    expect(looksLikeDbKey('a'.repeat(63))).toBe(false);
    expect(looksLikeDbKey(`${'a'.repeat(63)}z`)).toBe(false);
    expect(looksLikeDbKey('not a key')).toBe(false);
  });
});
