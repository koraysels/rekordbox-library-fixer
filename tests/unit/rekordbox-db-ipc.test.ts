import { describe, it, expect, vi } from 'vitest';
import { handleParseRekordboxDb } from '../../src/main/rekordboxDbIpc';

const library = { libraryPath: '/db', tracks: new Map(), playlists: [] } as any;

describe('handleParseRekordboxDb', () => {
  it('returns the parsed library on success', async () => {
    const parseDb = vi.fn().mockResolvedValue(library);
    const result = await handleParseRekordboxDb({ dbPath: '/db', key: 'abc' }, parseDb);
    expect(result).toEqual({ success: true, data: library });
    expect(parseDb).toHaveBeenCalledWith('/db', 'abc');
  });

  it('refuses an empty key without touching the database', async () => {
    const parseDb = vi.fn();
    const result = await handleParseRekordboxDb({ dbPath: '/db', key: '   ' }, parseDb);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/key/i);
    expect(parseDb).not.toHaveBeenCalled();
  });

  it('trims a pasted key', async () => {
    const parseDb = vi.fn().mockResolvedValue(library);
    await handleParseRekordboxDb({ dbPath: '/db', key: '  abc\n' }, parseDb);
    expect(parseDb).toHaveBeenCalledWith('/db', 'abc');
  });

  it('explains a wrong key instead of repeating SQLCipher wording', async () => {
    const parseDb = vi.fn().mockRejectedValue(new Error('file is not a database'));
    const result = await handleParseRekordboxDb({ dbPath: '/db', key: 'wrong' }, parseDb);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/check the key/i);
    expect(result.error).not.toMatch(/not a database/i);
  });

  it('passes through an unrelated failure', async () => {
    const parseDb = vi.fn().mockRejectedValue(new Error('EACCES: permission denied'));
    const result = await handleParseRekordboxDb({ dbPath: '/db', key: 'abc' }, parseDb);
    expect(result.error).toMatch(/EACCES/);
  });
});
