import React, { useEffect, useState } from 'react';
import { FolderOpen, FileText, Database, Clock, Copy, Check } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  keyCommandFor, platformFromUserAgent, looksLikeDbKey,
} from '../../utils/keyExtractionCommand';

interface FoundLibrary {
  kind: 'database' | 'xml';
  path: string;
  label: string;
  size: number;
  modified: string;
}

interface EmptyLibraryStateProps {
  onSelectLibrary: () => void;
  onLoadFromDb?: (dbPath?: string) => void;
  onLoadLibrary: (filePath: string) => void;
}

const megabytes = (size: number) => `${(size / 1048576).toFixed(1)} MB`;

/**
 * Choosing a library. Rekordbox's own database leads, because it is the only
 * source that can actually be cleaned: an XML export is a snapshot, and a
 * rekordbox import can add and update tracks but never remove one, so fixes
 * made through XML never reach the collection. XML stays for people who work
 * that way, one step down rather than as the headline.
 */
export const EmptyLibraryState: React.FC<EmptyLibraryStateProps> = ({
  onSelectLibrary,
  onLoadFromDb,
  onLoadLibrary
}) => {
  const dbKey = useSettingsStore((state) => state.rekordboxDbKey);
  const setRekordboxDbKey = useSettingsStore((state) => state.setRekordboxDbKey);
  const [pendingDb, setPendingDb] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const keyCommand = keyCommandFor(platformFromUserAgent(navigator.userAgent));
  const [found, setFound] = useState<FoundLibrary[]>([]);

  // The library this app had open last, so the usual case is one obvious click.
  const [lastOpened, setLastOpened] = useState<string>('');

  useEffect(() => {
    window.electronAPI.scanForLibraries?.()
      .then((libs) => setFound(libs ?? []))
      .catch(() => setFound([]));
    try {
      setLastOpened(localStorage.getItem('rekordboxLibraryPath') ?? '');
    } catch { /* private mode, no memory of the last one */ }
  }, []);

  const databases = found.filter((lib) => lib.kind === 'database');
  const exports = found.filter((lib) => lib.kind === 'xml');

  const openDatabase = (dbPath: string) => {
    if (dbKey.trim()) { onLoadFromDb?.(dbPath); } else { setPendingDb(dbPath); }
  };

  const Row: React.FC<{ lib: FoundLibrary }> = ({ lib }) => {
    const isDatabase = lib.kind === 'database';
    const isLast = lib.path === lastOpened;
    return (
      <button
        type="button"
        onClick={() => (isDatabase ? openDatabase(lib.path) : onLoadLibrary(lib.path))}
        title={lib.path}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-te border text-left transition-colors
          ${isLast
            ? 'border-te-orange bg-te-orange/5 hover:bg-te-orange/10'
            : 'border-te-grey-300 bg-te-grey-100 hover:bg-te-grey-200 hover:border-te-orange'}`}
      >
        {isDatabase
          ? <Database className="w-4 h-4 flex-shrink-0 text-te-orange" />
          : <FileText className="w-4 h-4 flex-shrink-0 text-te-grey-500" />}
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="block te-path text-xs text-te-grey-800 truncate">{lib.label}</span>
            {isLast && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 text-[9px] font-te-mono
                               uppercase tracking-wider px-1.5 py-0.5 rounded-te
                               bg-te-orange text-te-cream">
                <Clock size={9} /> Last opened
              </span>
            )}
          </span>
          <span className="block text-[10px] font-te-mono text-te-grey-500 normal-case">
            {isDatabase ? 'rekordbox database' : 'XML export'}
            {' · '}{megabytes(lib.size)}
            {' · '}changed {new Date(lib.modified).toLocaleDateString()}
          </span>
          {/* The full path: two libraries can share a name, and it is the only
              way to be sure which file you are opening. */}
          <span className="block te-path-tail text-[10px] text-te-grey-400 mt-0.5">{lib.path}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="h-full flex items-center justify-center py-te-xl px-te-lg bg-te-grey-100">
      <div className="text-center max-w-lg w-full">
        <div className="mb-te-xl">
          <div className="w-16 h-16 mx-auto mb-te-lg bg-white rounded-te flex items-center justify-center">
            <img
              src="/icons/64x64.png"
              alt="Rekordbox Library Fixer"
              className="w-12 h-12 opacity-90"
            />
          </div>
          <h2 className="font-te-display text-xl font-bold text-te-grey-800 mb-te-sm uppercase tracking-tight">
            REKORDBOX LIBRARY FIXER
          </h2>
          <p className="text-te-grey-500 font-te-mono text-sm tracking-wider">
            MANAGE • CLEAN • OPTIMIZE
          </p>
        </div>

        {/* The database leads: it is the only source the app can really fix. */}
        <div className="bg-te-cream border-2 border-te-grey-300 rounded-te-lg p-te-lg mb-te-lg shadow-sm text-left">
          <div className="flex items-center gap-2 mb-te-sm">
            <Database className="w-4 h-4 text-te-orange" />
            <h3 className="font-te-display text-sm font-semibold text-te-grey-800 uppercase tracking-wide">
              Rekordbox database
            </h3>
          </div>

          {databases.length > 0 ? (
            <>
              <p className="text-te-grey-500 font-te-mono text-xs normal-case mb-te-md leading-relaxed">
                {databases.length === 1
                  ? 'Found on this machine. Changes are written straight into your collection.'
                  : `${databases.length} found on this machine. Changes are written straight into the one you open.`}
              </p>
              <div className="space-y-1.5">
                {databases.map((lib) => <Row key={lib.path} lib={lib} />)}
              </div>
            </>
          ) : (
            <p className="text-te-grey-500 font-te-mono text-xs normal-case leading-relaxed">
              No rekordbox database found in the usual place. Rekordbox 6 or 7 has to be
              installed for this machine to have one; otherwise open an XML export below.
            </p>
          )}

          {pendingDb && (
            <div className="mt-te-md rounded-te border border-te-orange bg-te-grey-100 p-3">
              <p className="text-[11px] font-te-mono text-te-grey-700 normal-case leading-relaxed mb-2">
                Rekordbox encrypts its database. Opening it needs the SQLCipher key, which is the
                same on every rekordbox 6/7 install. This app does not ship it — run this in{' '}
                {keyCommand.shell} and it prints the key on your own machine, from the
                open-source <span className="te-value">pyrekordbox</span> project:
              </p>

              {/* The command, ready to paste. Describing where to find the key
                  sent people hunting through documentation for a value their
                  own machine can produce in one line. */}
              <div className="flex items-start gap-2 mb-2">
                <code className="te-code-block flex-1 min-w-0 text-[10px] leading-relaxed break-all">
                  {keyCommand.command}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(keyCommand.command)
                      .then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      })
                      .catch(() => undefined);
                  }}
                  title="Copy the command"
                  className="flex-shrink-0 btn-ghost text-[10px] px-2 py-1"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>

              <p className="text-[11px] font-te-mono text-te-grey-500 normal-case leading-relaxed mb-2">
                Paste the 64-character result below. It stays on this machine.
              </p>
              <input
                type="text"
                value={dbKey}
                onChange={(e) => setRekordboxDbKey(e.target.value.trim())}
                placeholder="Paste the master.db key (starts with 402fd…)"
                spellCheck={false}
                autoComplete="off"
                autoFocus
                className="input w-full te-path text-xs mb-1"
              />
              {dbKey.trim() !== '' && !looksLikeDbKey(dbKey) && (
                <p className="text-[10px] font-te-mono text-te-amber-600 normal-case mb-2">
                  That is not 64 hexadecimal characters — check the whole line was copied.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { onLoadFromDb?.(pendingDb); setPendingDb(null); }}
                  disabled={!looksLikeDbKey(dbKey)}
                  className="btn-secondary text-xs disabled:opacity-40"
                >
                  Open database
                </button>
                <button type="button" onClick={() => setPendingDb(null)} className="btn-ghost text-xs">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* XML, one step down: readable, but a snapshot that cannot clean anything. */}
        <div className="rounded-te-lg border border-te-grey-300 bg-te-grey-100 p-te-lg text-left">
          <div className="flex items-center gap-2 mb-te-sm">
            <FileText className="w-4 h-4 text-te-grey-500" />
            <h3 className="font-te-display text-xs font-semibold text-te-grey-600 uppercase tracking-wide">
              Or open an XML export
            </h3>
          </div>
          <p className="text-te-grey-500 font-te-mono text-[11px] normal-case mb-te-md leading-relaxed">
            A snapshot of your collection at the moment it was exported. Rekordbox can import
            one, but an import never removes a track — so cleaning up has to go through the
            database above.
          </p>

          {exports.length > 0 && (
            <div className="space-y-1.5 mb-te-md">
              {exports.map((lib) => <Row key={lib.path} lib={lib} />)}
            </div>
          )}

          <button
            type="button"
            onClick={onSelectLibrary}
            className="btn-secondary text-xs flex items-center gap-te-sm"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Browse for an XML file</span>
          </button>
        </div>
      </div>
    </div>
  );
};
