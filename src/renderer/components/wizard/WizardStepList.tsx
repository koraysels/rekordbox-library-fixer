import React from 'react';
import { Check, Minus, ChevronRight } from 'lucide-react';
import { wizardSidebarItems, useWizardProgressStore, type SidebarItem } from '../../wizard/wizardProgress';

const FALLBACK = wizardSidebarItems({
  screen: 'setup', phase: 'summary', setupDone: false, check: undefined,
  runSteps: [], done: [], skipped: [], nextStep: undefined,
});

const NOTE: Partial<Record<SidebarItem['state'], string>> = {
  skipped: 'skipped',
  nothing: 'nothing to do',
};

/**
 * The wizard's steps in the sidebar, where the Advanced pages are listed in
 * the other mode: every step, which is done, and which one is on screen. Not
 * clickable — the wizard runs them in order.
 */
export const WizardStepList: React.FC = () => {
  const items = useWizardProgressStore((s) => s.items) ?? FALLBACK;
  return (
    <ol aria-label="Wizard steps" className="space-y-te-sm">
      {items.map((item, i) => {
        const current = item.state === 'current';
        const dim = item.state === 'nothing' || item.state === 'skipped';
        const note = NOTE[item.state] ?? (item.count !== undefined && item.state !== 'done' ? String(item.count) : undefined);
        return (
          <li
            key={item.id}
            aria-current={current ? 'step' : undefined}
            className={`flex items-center gap-te-md p-te-md rounded-te border-2 font-te-mono text-xs font-medium uppercase tracking-wider transition-colors duration-200
              ${current
                ? 'bg-te-orange text-te-cream border-te-orange shadow-lg'
                : dim
                  ? 'bg-te-grey-300/40 text-te-grey-400 border-te-grey-300/50'
                  : 'bg-te-cream text-te-grey-700 border-te-grey-300'}`}
          >
            <span
              className={`w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-[10px]
                ${current ? 'bg-te-cream text-te-orange'
                  : item.state === 'done' ? 'bg-te-green-500 text-te-cream'
                    : 'border border-current'}`}
            >
              {item.state === 'done' ? <Check className="w-3 h-3" aria-label="done" />
                : dim ? <Minus className="w-3 h-3" />
                  : current ? <ChevronRight className="w-3 h-3" />
                    : i + 1}
            </span>
            <span className={`flex-1 min-w-0 ${dim ? 'line-through decoration-1' : ''}`}>{item.label}</span>
            {note && <span className={`flex-shrink-0 normal-case text-[10px] ${current ? 'text-te-cream' : 'text-te-grey-500'}`}>{note}</span>}
          </li>
        );
      })}
    </ol>
  );
};
