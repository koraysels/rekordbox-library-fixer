import React from 'react';
import { Check } from 'lucide-react';
import { wizardSidebarItems, useWizardProgressStore, type SidebarItem } from '../../wizard/wizardProgress';

const FALLBACK = wizardSidebarItems({
  screen: 'setup', phase: 'summary', setupDone: false, check: undefined,
  runSteps: [], done: [], skipped: [], nextStep: undefined,
});

const NOTE: Partial<Record<SidebarItem['state'], string>> = {
  skipped: 'Skipped',
  nothing: 'Nothing to do',
  done: 'Done',
};

const Dot: React.FC<{ state: SidebarItem['state'] }> = ({ state }) => {
  switch (state) {
    case 'done':
      return (
        <span className="w-4 h-4 rounded-full bg-te-green-500 text-te-cream flex items-center justify-center">
          <Check className="w-2.5 h-2.5" strokeWidth={3} aria-label="done" />
        </span>
      );
    case 'current':
      return (
        <span className="w-4 h-4 rounded-full bg-te-orange ring-4 ring-te-orange/25 flex items-center justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-te-cream" />
        </span>
      );
    case 'upcoming':
      return <span className="w-4 h-4 rounded-full border-2 border-te-grey-400 bg-te-grey-200" />;
    default:
      return <span className="w-2 h-2 rounded-full bg-te-grey-300" />;
  }
};

/**
 * The wizard's steps in the sidebar, as a timeline: every step, which are done,
 * and which one is on screen. Not clickable — the wizard runs them in order.
 */
export const WizardStepList: React.FC = () => {
  const items = useWizardProgressStore((s) => s.items) ?? FALLBACK;
  return (
    <ol aria-label="Wizard steps" className="pl-1">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        const current = item.state === 'current';
        const dim = item.state === 'nothing' || item.state === 'skipped';
        // The line below a finished step is filled in up to where the run is.
        const lineDone = item.state === 'done' || dim;
        const note = NOTE[item.state] ?? (item.count !== undefined ? `${item.count} tracks` : undefined);
        return (
          <li key={item.id} aria-current={current ? 'step' : undefined} className="relative flex gap-te-md">
            <div className="flex flex-col items-center w-4 flex-shrink-0">
              <div className="h-5 flex items-center justify-center"><Dot state={item.state} /></div>
              {!last && <div className={`w-0.5 flex-1 min-h-[18px] ${lineDone ? 'bg-te-green-500/60' : 'bg-te-grey-300'}`} />}
            </div>
            <div className={`min-w-0 flex-1 ${last ? '' : 'pb-te-lg'}`}>
              <p
                className={`leading-5 font-te-mono text-xs uppercase tracking-wider
                  ${current ? 'text-te-orange font-bold'
                    : dim ? 'text-te-grey-400 line-through decoration-1'
                      : item.state === 'done' ? 'text-te-grey-600'
                        : 'text-te-grey-700'}`}
              >
                {item.label}
              </p>
              {note && (
                <p className={`text-[10px] font-te-mono normal-case ${current ? 'text-te-orange/80' : 'text-te-grey-400'}`}>
                  {note}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};
