import React, { useEffect, useState } from 'react';
import { Copy, Check, Database, FolderOpen } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { PLAYER_PROFILES } from '../../../main/convert/playerProfiles';
import { keyCommandFor, platformFromUserAgent, looksLikeDbKey } from '../../utils/keyExtractionCommand';
import { EmptyLibraryState } from '../ui/EmptyLibraryState';
import { WizardFrame, ErrorLine } from './WizardFrame';

interface FoundLibrary { kind: 'database' | 'xml'; path: string; label: string; size: number; modified: string }

/**
 * A database waiting for its key. Held by the wizard page, not here: opening
 * a database swaps this screen for the loading spinner, so state kept in it
 * would be gone by the time the load reports that the key did not work.
 */
export interface KeyRequest {
  dbPath: string;
  /** The key that was tried and did not open it; absent when there was none to try. */
  failedKey?: string;
}

interface Props {
  /** A rekordbox database is open. */
  hasDatabase: boolean;
  keyRequest: KeyRequest | null;
  onKeyRequest: (request: KeyRequest | null) => void;
  onLoadFromDb?: (dbPath?: string) => Promise<boolean> | void;
  onLoadLibrary?: (path: string) => void;
  onSelectLibrary?: () => void;
}

/**
 * The questions asked once: which database, its key only when the bundled one
 * does not open it, the oldest player, and the music folder. Each answer is
 * kept in settings, so the wizard comes back here only for what is missing.
 */
export const SetupScreen: React.FC<Props> = ({ hasDatabase, ...databaseProps }) => {
  const [askedPlayer, setAskedPlayer] = useState(false);
  if (!hasDatabase) {
    return <DatabaseStep {...databaseProps} />;
  }
  if (!askedPlayer) {return <PlayerStep onNext={() => setAskedPlayer(true)} />;}
  return <FolderStep />;
};

const DatabaseStep: React.FC<Omit<Props, 'hasDatabase'>> = ({
  keyRequest, onKeyRequest, onLoadFromDb, onLoadLibrary, onSelectLibrary,
}) => {
  const key = useSettingsStore((s) => s.rekordboxDbKey);
  const [found, setFound] = useState<FoundLibrary[] | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.resolve(window.electronAPI.scanForLibraries?.())
      .then((libs) => { if (alive) {setFound(libs ?? []);} })
      .catch(() => { if (alive) {setFound([]);} });
    return () => { alive = false; };
  }, []);

  /** Try the key the app has (bundled or saved); ask for one only when that does not open it. */
  // The load usually unmounts this step; the answer goes to the page, which outlives it.
  const open = async (dbPath: string) => {
    const tried = useSettingsStore.getState().rekordboxDbKey;
    if (!looksLikeDbKey(tried)) {
      onKeyRequest({ dbPath });
      return;
    }
    setOpening(true);
    try {
      const opened = await onLoadFromDb?.(dbPath);
      onKeyRequest(opened === false ? { dbPath, failedKey: tried } : null);
    } finally {
      setOpening(false);
    }
  };

  if (keyRequest) {
    return (
      <KeyStep
        failed={keyRequest.failedKey !== undefined && key === keyRequest.failedKey}
        opening={opening}
        onOpen={() => void open(keyRequest.dbPath)}
        onBack={() => onKeyRequest(null)}
      />
    );
  }

  const databases = (found ?? []).filter((lib) => lib.kind === 'database');
  if (found && databases.length === 1) {
    const db = databases[0];
    return (
      <WizardFrame
        title="Your rekordbox library"
        lead="This is the collection rekordbox uses. The wizard fixes it in place, with rekordbox closed and a backup taken before every change."
        actions={
          <button type="button" className="btn-primary flex items-center gap-2" disabled={opening} onClick={() => void open(db.path)}>
            <Database className="w-4 h-4" />
            {opening ? 'Opening…' : 'Open this library'}
          </button>
        }
      >
        <p className="te-path-tail text-xs text-te-grey-500" title={db.path}>{db.path}</p>
      </WizardFrame>
    );
  }

  // Several databases or none: the home screen's picker, which also offers XML.
  return (
    <EmptyLibraryState
      onSelectLibrary={() => onSelectLibrary?.()}
      onLoadLibrary={(p) => onLoadLibrary?.(p)}
      onLoadFromDb={(p) => { if (p) {void open(p);} else {void onLoadFromDb?.();} }}
    />
  );
};

const KeyStep: React.FC<{ failed: boolean; opening: boolean; onOpen: () => void; onBack: () => void }> = ({
  failed, opening, onOpen, onBack,
}) => {
  const key = useSettingsStore((s) => s.rekordboxDbKey);
  const setKey = useSettingsStore((s) => s.setRekordboxDbKey);
  const [copied, setCopied] = useState(false);
  const command = keyCommandFor(platformFromUserAgent(navigator.userAgent));

  return (
    <WizardFrame
      title="Your database needs its key"
      lead={
        <>
          {failed && <p className="mb-2">The database did not open with the key this app has. A rekordbox update may have changed it.</p>}
          <p>
            Run this in {command.shell}. It prints the key on your own machine, using the open-source
            pyrekordbox project. Paste the 64-character result below; it stays on this machine.
          </p>
        </>
      }
      actions={
        <>
          <button type="button" className="btn-primary" disabled={!looksLikeDbKey(key) || opening} onClick={onOpen}>
            {opening ? 'Opening…' : 'Open database'}
          </button>
          <button type="button" className="btn-ghost" onClick={onBack}>Back</button>
        </>
      }
    >
      <div className="flex items-start gap-2">
        <code className="te-code-block flex-1 min-w-0 text-[10px] leading-relaxed break-all">{command.command}</code>
        <button
          type="button"
          title="Copy the command"
          className="flex-shrink-0 btn-ghost text-[10px] px-2 py-1"
          onClick={() => {
            void navigator.clipboard?.writeText(command.command)
              .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
              .catch(() => undefined);
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
      <input
        type="text"
        aria-label="Database key"
        value={key}
        onChange={(e) => setKey(e.target.value.trim())}
        placeholder="Paste the master.db key"
        spellCheck={false}
        autoComplete="off"
        className="input w-full te-path text-xs"
      />
      {key.trim() !== '' && !looksLikeDbKey(key) && (
        <ErrorLine message="That is not 64 hexadecimal characters. Check the whole line was copied." />
      )}
    </WizardFrame>
  );
};

const PlayerStep: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const player = useSettingsStore((s) => s.oldestPlayer);
  const setPlayer = useSettingsStore((s) => s.setOldestPlayer);
  return (
    <WizardFrame
      title="Which player do you play on?"
      lead="Pick the oldest one you play on. Tracks it cannot play are converted so they play everywhere."
      actions={<button type="button" className="btn-primary" onClick={onNext}>Next</button>}
    >
      <select
        aria-label="Oldest player"
        className="input max-w-sm"
        value={player}
        onChange={(e) => setPlayer(e.target.value as typeof player)}
      >
        {Object.values(PLAYER_PROFILES).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
    </WizardFrame>
  );
};

const FolderStep: React.FC = () => {
  const setMusicFolder = useSettingsStore((s) => s.setMusicFolder);
  const choose = async () => {
    const folder = await window.electronAPI.selectFolder();
    if (folder) {setMusicFolder(folder);}
  };
  return (
    <WizardFrame
      title="Where do you keep your music?"
      lead="One folder for all your tracks. Tracks outside it are moved in, and moved tracks are looked for here first."
      actions={
        <button type="button" className="btn-primary flex items-center gap-2" onClick={() => void choose()}>
          <FolderOpen className="w-4 h-4" />
          Choose music folder
        </button>
      }
    />
  );
};
