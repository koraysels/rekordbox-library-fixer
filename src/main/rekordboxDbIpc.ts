import type { DbLibrary } from './rekordboxDbParser';

/**
 * Turn a parse attempt into a result the renderer can act on. SQLCipher
 * reports a wrong key as "file is not a database", which is meaningless to a
 * DJ, so it is translated here.
 */
export async function handleParseRekordboxDb(
  args: { dbPath: string; key: string },
  parseDb: (dbPath: string, key: string) => Promise<DbLibrary>
): Promise<{ success: boolean; data?: DbLibrary; error?: string }> {
  const key = (args.key ?? '').trim();
  if (!key) {
    return { success: false, error: 'No database key — paste your master.db key in Settings.' };
  }
  try {
    return { success: true, data: await parseDb(args.dbPath, key) };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const wrongKey = /not a database|encrypt|cipher|key/i.test(message);
    return {
      success: false,
      error: wrongKey
        ? 'Could not decrypt the database — check the key.'
        : `Could not read the database: ${message}`,
    };
  }
}
