import React from 'react';
import { RotateCw, History } from 'lucide-react';
import type { StepResult } from '../../../main/wizard/types';
import { DONE_NOTE } from '../../wizard/stepText';
import { describeResult } from '../../wizard/wizardHistory';
import { WizardFrame } from './WizardFrame';

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Props {
  /** What each step did this time, in order. */
  results: StepResult[];
  onCheckAgain: () => void;
  onOpenHistory: () => void;
}

/** The end of a run: what changed, and the one thing left to do in rekordbox. */
export const DoneScreen: React.FC<Props> = ({ results, onCheckAgain, onOpenHistory }) => (
  <WizardFrame
    title="That's everything"
    lead={DONE_NOTE}
    actions={
      <>
        <button type="button" className="btn-primary flex items-center gap-2" onClick={onCheckAgain}>
          <RotateCw className="w-4 h-4" />
          Check again
        </button>
        <button type="button" className="btn-ghost flex items-center gap-2" onClick={onOpenHistory}>
          <History className="w-4 h-4" />
          See History and backups
        </button>
      </>
    }
  >
    {results.length > 0 ? (
      <ul aria-label="What changed" className="border-2 border-te-grey-300 rounded-te divide-y divide-te-grey-200 bg-te-cream">
        {results.map((r, i) => (
          <li key={`${r.step}-${i}`} className="px-3 py-2 text-sm text-te-grey-800 font-te-mono normal-case">
            {sentence(describeResult(r))}
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm font-te-mono normal-case text-te-grey-600">Nothing was changed this time.</p>
    )}
  </WizardFrame>
);
