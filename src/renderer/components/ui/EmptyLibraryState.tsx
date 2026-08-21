import React, { useEffect, useState } from 'react';
import { FolderOpen, FileText, Database } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';

interface EmptyLibraryStateProps {
  onSelectLibrary: () => void;
  onLoadFromDb?: () => void;
  onLoadLibrary: (filePath: string) => void;
}

export const EmptyLibraryState: React.FC<EmptyLibraryStateProps> = ({
  onSelectLibrary,
  onLoadFromDb,
  onLoadLibrary
}) => {
  const dbKey = useSettingsStore((state) => state.rekordboxDbKey);
  const setRekordboxDbKey = useSettingsStore((state) => state.setRekordboxDbKey);
  const [askingForKey, setAskingForKey] = useState(false);
  const [found, setFound] = useState<Array<{
    kind: 'database' | 'xml'; path: string; label: string; size: number; modified: string;
  }>>([]);

  useEffect(() => {
    window.electronAPI.scanForLibraries?.()
      .then((libs) => setFound(libs ?? []))
      .catch(() => setFound([]));
  }, []);

  return (
    <div className="h-full flex items-center justify-center py-te-xl px-te-lg bg-te-grey-100">
      <div className="text-center max-w-lg w-full">
        {/* App Logo - TE Minimal */}
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

        {/* Load Library Section - TE Calculator Style */}
        <div className="bg-te-cream border-2 border-te-grey-300 rounded-te-lg p-te-xl mb-te-lg shadow-sm">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-te-grey-200 rounded-te flex items-center justify-center mb-te-md">
              <FileText className="w-6 h-6 text-te-grey-600" />
            </div>
            <h3 className="font-te-display text-sm font-semibold text-te-grey-800 mb-te-sm uppercase tracking-wide">
              Load XML Library
            </h3>
            <p className="text-te-grey-500 font-te-mono text-sm mb-te-lg leading-relaxed text-center">
              Select your Rekordbox XML export file to begin
            </p>
            <button
              type="button"
              onClick={onSelectLibrary}
              className="bg-te-orange hover:bg-te-orange/90 text-te-cream
                       font-te-display text-xs font-semibold py-te-md px-te-lg rounded-te
                       border-2 border-te-orange hover:shadow-lg
                       transition-all duration-200 flex items-center gap-te-sm uppercase tracking-wider
                       hover:animate-te-glow"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Browse Files</span>
            </button>
          </div>
        </div>

        {/* Libraries this machine already has, so the usual case is one click
            rather than hunting through a file dialog. */}
        {found.length > 0 && (
          <div className="mt-te-lg w-full max-w-lg mx-auto">
            <div className="flex items-center gap-3 mb-te-md">
              <div className="flex-1 h-px bg-te-grey-300" />
              <span className="text-[11px] font-te-mono text-te-grey-400 uppercase tracking-wider">
                found on this machine
              </span>
              <div className="flex-1 h-px bg-te-grey-300" />
            </div>

            <div className="space-y-1.5">
              {found.map((lib) => (
                <button
                  key={lib.path}
                  type="button"
                  onClick={() => {
                    if (lib.kind !== 'database') { onLoadLibrary(lib.path); return; }
                    if (dbKey.trim()) { onLoadFromDb?.(); } else { setAskingForKey(true); }
                  }}
                  title={lib.path}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-te border border-te-grey-300
                             bg-te-grey-100 hover:bg-te-grey-200 hover:border-te-orange
                             transition-colors text-left group"
                >
                  {lib.kind === 'database'
                    ? <Database className="w-4 h-4 flex-shrink-0 text-te-orange" />
                    : <FileText className="w-4 h-4 flex-shrink-0 text-te-grey-500" />}
                  <span className="flex-1 min-w-0">
                    <span className="block te-path text-xs text-te-grey-800 truncate">{lib.label}</span>
                    <span className="block text-[10px] font-te-mono text-te-grey-500 normal-case">
                      {lib.kind === 'database' ? 'rekordbox database · read-only' : 'XML export'}
                      {' · '}{(lib.size / 1048576).toFixed(1)} MB
                      {' · '}{new Date(lib.modified).toLocaleDateString()}
                    </span>
                    {/* The full path: two exports can share a name, and it is
                        the only way to be sure which file you are opening. */}
                    <span className="block te-path-tail text-[10px] text-te-grey-400 mt-0.5">
                      {lib.path}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {askingForKey && (
              <div className="mt-2 rounded-te border border-te-orange bg-te-grey-100 p-3">
                <p className="text-[11px] font-te-mono text-te-grey-700 normal-case leading-relaxed mb-2">
                  Rekordbox encrypts its database. Opening it needs the SQLCipher key, which is
                  the same on every rekordbox 6/7 install and is published by the open-source
                  <span className="te-value"> pyrekordbox </span> project: see its documentation
                  under &ldquo;Rekordbox 6 database key&rdquo;. This app does not ship the key.
                  Paste it once and it stays on this machine.
                </p>
                <input
                  type="text"
                  value={dbKey}
                  onChange={(e) => setRekordboxDbKey(e.target.value.trim())}
                  placeholder="Paste the master.db key (starts with 402fd…)"
                  spellCheck={false}
                  autoComplete="off"
                  autoFocus
                  className="input w-full te-path text-xs mb-2"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onLoadFromDb?.()}
                    disabled={!dbKey.trim()}
                    className="btn-secondary text-xs disabled:opacity-40"
                  >
                    Open database
                  </button>
                  <button type="button" onClick={() => setAskingForKey(false)} className="btn-ghost text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* File Type Info - Minimal TE */}
        <div className="text-center">
          <p className="text-xs text-te-grey-400 font-te-mono uppercase tracking-wider mb-te-sm">
            Supported Formats
          </p>
          <div className="flex items-center justify-center gap-te-lg text-te-grey-500">
            <div className="flex items-center gap-te-xs bg-te-grey-200 px-te-sm py-te-xs rounded-te">
              <FileText className="w-3 h-3" />
              <span className="font-te-mono text-xs tracking-wider">XML</span>
            </div>
            <div className="w-1 h-1 bg-te-grey-300 rounded-full"></div>
            <div className="flex items-center gap-te-xs bg-te-grey-200 px-te-sm py-te-xs rounded-te">
              <FileText className="w-3 h-3" />
              <span className="font-te-mono text-xs tracking-wider">COLLECTION</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
