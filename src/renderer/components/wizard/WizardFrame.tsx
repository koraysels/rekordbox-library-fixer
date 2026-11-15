import React from 'react';
import { Loader2 } from 'lucide-react';
import type { WizardProgress } from '../../../main/ipcContract';
import type { StepListItem } from '../../wizard/stepText';
import { ProgressBar } from '../ui/ProgressBar';

/**
 * The one layout every wizard screen shares: a calm centred column, one
 * heading, a sentence or two, then whatever the screen is about and its
 * buttons. One thing per screen.
 */
export const WizardFrame: React.FC<{
  title: string;
  /** Where in the run this screen is, e.g. "Step 2 of 4". */
  position?: string;
  lead?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, position, lead, children, actions }) => (
  <div className="h-full overflow-y-auto">
    <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        {position && <p className="text-xs font-te-mono text-te-orange">{position}</p>}
        <h2 className="font-te-display text-2xl font-bold text-te-grey-800 tracking-tight">{title}</h2>
        {lead && <div className="text-sm text-te-grey-600 font-te-mono normal-case leading-relaxed max-w-prose">{lead}</div>}
      </header>
      {children}
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  </div>
);

/** A long call running: what it is doing, how far along, and a way to stop it. */
export const WorkingPanel: React.FC<{
  progress: WizardProgress | null;
  fallback: string;
  onCancel?: () => void;
}> = ({ progress, fallback, onCancel }) => {
  const [cancelling, setCancelling] = React.useState(false);
  const percent = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : null;
  return (
    <div role="status" className="rounded-te border-2 border-te-grey-300 bg-te-cream p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 text-te-orange animate-spin flex-shrink-0" />
        <span className="flex-1 text-sm text-te-grey-800 font-te-mono normal-case break-all">
          {progress?.message || fallback}
        </span>
        {percent !== null && <span className="text-xs font-te-mono text-te-grey-500">{progress?.current} / {progress?.total}</span>}
      </div>
      {percent !== null && (
        <ProgressBar label={fallback.replace(/…$/, '')} value={progress?.current ?? 0} max={progress?.total ?? 0} />
      )}
      {onCancel && (
        <div>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={cancelling}
            onClick={() => { setCancelling(true); onCancel(); }}
          >
            {cancelling ? 'Stopping…' : 'Cancel'}
          </button>
        </div>
      )}
    </div>
  );
};

export const ErrorLine: React.FC<{ message: string | null | undefined }> = ({ message }) =>
  message ? (
    <p role="alert" className="text-sm font-te-mono normal-case text-te-red-500 leading-relaxed">{message}</p>
  ) : null;

/** A scrollable list behind a count, so the confirm never hides what it changes. */
export const ItemList: React.FC<{ items: StepListItem[]; label: string }> = ({ items, label }) => (
  <ul
    aria-label={label}
    className="border-2 border-te-grey-300 rounded-te divide-y divide-te-grey-200 max-h-72 overflow-y-auto bg-te-cream"
  >
    {items.map((item) => (
      <li key={item.key} className="px-3 py-2 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-te-grey-800 truncate">{item.primary}</p>
          {item.secondary && (
            <p className="text-xs font-te-mono normal-case text-te-grey-500 te-path-tail" title={item.secondary}>{item.secondary}</p>
          )}
        </div>
        {item.note && <span className="flex-shrink-0 text-xs font-te-mono normal-case text-te-grey-600">{item.note}</span>}
      </li>
    ))}
  </ul>
);
