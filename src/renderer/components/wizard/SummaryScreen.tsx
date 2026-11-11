import React from 'react';
import { Search, ArrowRight, RotateCw, FolderOpen } from 'lucide-react';
import type { WizardCheck } from '../../../main/wizard/types';
import type { WizardProgress } from '../../../main/ipcContract';
import { stepsFor } from '../../wizard/wizardFlow';
import { WizardFrame, WorkingPanel, ErrorLine } from './WizardFrame';

interface Props {
  /** The last check of this library, if there is one. */
  check?: WizardCheck;
  /** The check was made just now. A saved one is shown, but fixing starts only after checking again. */
  fresh: boolean;
  playerName: string;
  /** Where files are gathered to; changeable here, since the setup that asked for it does not come back. */
  musicFolder: string;
  onChangeMusicFolder: () => void;
  busy: boolean;
  progress: WizardProgress | null;
  error: string | null;
  onCheck: () => void;
  onStart: () => void;
  onCancel: () => void;
}

const checkedWhen = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};

/**
 * One scan, then what it found, in four numbers. The app never scans by
 * itself: coming back shows the last result and a "Check again" button.
 */
export const SummaryScreen: React.FC<Props> = ({
  check, fresh, playerName, musicFolder, onChangeMusicFolder, busy, progress, error, onCheck, onStart, onCancel,
}) => {
  const folderLine = (
    <div className="flex items-center gap-2 text-xs font-te-mono normal-case text-te-grey-600">
      <span className="flex-shrink-0">Music folder:</span>
      <span className="te-path-tail flex-1 min-w-0" title={musicFolder}>{musicFolder}</span>
      {!busy && (
        <button type="button" className="btn-ghost text-xs flex items-center gap-1 flex-shrink-0" onClick={onChangeMusicFolder}>
          <FolderOpen className="w-3 h-3" />
          Change
        </button>
      )}
    </div>
  );
  const working = busy ? <WorkingPanel progress={progress} fallback="Checking your library…" onCancel={onCancel} /> : null;

  if (!check) {
    return (
      <WizardFrame
        title="Fix my library"
        lead="One check finds tracks that moved, entries that point at nothing, duplicates, files outside your music folder and tracks your player can't play. Nothing changes until you confirm each step."
        actions={busy ? undefined : (
          <button type="button" className="btn-primary flex items-center gap-2" onClick={onCheck}>
            <Search className="w-4 h-4" />
            Check my library
          </button>
        )}
      >
        {folderLine}
        {working}
        <ErrorLine message={error} />
      </WizardFrame>
    );
  }

  const steps = stepsFor(check);
  const tiles: Array<{ value: number; label: string }> = [
    { value: check.missing, label: 'missing' },
    { value: check.duplicates, label: 'duplicates' },
    { value: check.unplayable, label: `won't play on your ${playerName}` },
    { value: check.outsideFolder, label: 'outside your music folder' },
  ];
  const nothingToDo = steps.length === 0;
  const when = checkedWhen(check.checkedAt);

  let lead: string;
  if (!fresh) {lead = `Last checked ${when}. Rekordbox may have changed things since, so check again before fixing.`;}
  else if (nothingToDo) {lead = 'Nothing to fix. Your library is in order.';}
  else {lead = `${steps.length} ${steps.length === 1 ? 'step' : 'steps'} to go. Each one shows what it will change and waits for you.`;}

  return (
    <WizardFrame
      title={fresh ? 'What the check found' : 'Your last check'}
      lead={lead}
      actions={busy ? undefined : (
        <>
          {fresh && !nothingToDo && (
            <button type="button" className="btn-primary flex items-center gap-2" onClick={onStart}>
              Start fixing
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            className={`${fresh && !nothingToDo ? 'btn-ghost' : 'btn-primary'} flex items-center gap-2`}
            onClick={onCheck}
          >
            <RotateCw className="w-4 h-4" />
            Check again
          </button>
        </>
      )}
    >
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-te border-2 border-te-grey-300 bg-te-cream px-4 py-3">
            <p className={`font-te-display text-3xl font-bold ${t.value > 0 ? 'text-te-orange' : 'text-te-grey-400'}`}>{t.value}</p>
            <p className="text-xs font-te-mono normal-case text-te-grey-600">{t.label}</p>
          </div>
        ))}
      </div>
      {folderLine}
      {check.unpluggedDrives.length > 0 && (
        <p className="text-xs font-te-mono normal-case text-te-grey-500">
          Not checked, because the drive is unplugged: {check.unpluggedDrives.join(', ')}. Plug it in and check again to include it.
        </p>
      )}
      {working}
      <ErrorLine message={error} />
    </WizardFrame>
  );
};
