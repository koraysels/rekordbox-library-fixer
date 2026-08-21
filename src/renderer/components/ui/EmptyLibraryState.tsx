import React from 'react';
import { FolderOpen, FileText } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';

interface EmptyLibraryStateProps {
  onSelectLibrary: () => void;
  onLoadFromDb?: () => void;
  onLoadLibrary: (filePath: string) => void;
}

export const EmptyLibraryState: React.FC<EmptyLibraryStateProps> = ({
  onSelectLibrary,
  onLoadFromDb,
  onLoadLibrary: _onLoadLibrary
}) => {
  const dbKey = useSettingsStore((state) => state.rekordboxDbKey);
  const setRekordboxDbKey = useSettingsStore((state) => state.setRekordboxDbKey);

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

        {/* The database is an alternative to the XML export, so it belongs
            beside it here, with the key it needs. */}
        {onLoadFromDb && (
          <div className="mt-te-lg w-full max-w-md mx-auto">
            <div className="flex items-center gap-3 mb-te-md">
              <div className="flex-1 h-px bg-te-grey-300" />
              <span className="text-[11px] font-te-mono text-te-grey-400 uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-te-grey-300" />
            </div>

            <div className="rounded-te border-2 border-te-grey-300 bg-te-grey-100 p-te-md">
              <h4 className="font-te-display text-sm font-semibold text-te-grey-800 uppercase tracking-te-display mb-1">
                Read rekordbox&apos;s database
              </h4>
              <p className="text-[11px] font-te-mono text-te-grey-500 normal-case leading-relaxed mb-te-sm">
                Skips the XML export. The database is opened read-only, so rekordbox can stay
                open. It is encrypted, so paste its key once. Applying changes still needs an
                XML library.
              </p>

              <input
                type="text"
                value={dbKey}
                onChange={(e) => setRekordboxDbKey(e.target.value.trim())}
                placeholder="Paste your master.db key"
                spellCheck={false}
                autoComplete="off"
                className="input w-full te-path text-xs mb-te-sm"
              />

              <button
                type="button"
                onClick={onLoadFromDb}
                disabled={!dbKey.trim()}
                className="w-full bg-te-grey-200 hover:bg-te-grey-300 disabled:opacity-40
                           disabled:hover:bg-te-grey-200 text-te-grey-800 font-te-display text-xs
                           font-semibold py-te-sm px-te-md rounded-te border-2 border-te-grey-300
                           transition-all duration-200 uppercase tracking-wider"
              >
                Load from database
              </button>

              {!dbKey.trim() && (
                <p className="text-[11px] font-te-mono text-te-grey-400 normal-case mt-te-xs">
                  The key is not shipped with this app. It is the same for every rekordbox 6/7
                  install and is documented by the open-source pyrekordbox project.
                </p>
              )}
            </div>
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
