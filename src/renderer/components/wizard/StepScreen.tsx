import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { StepPlan } from '../../../main/wizard/types';
import type { WizardProgress } from '../../../main/ipcContract';
import { isEmptyPlan } from '../../wizard/wizardFlow';
import { ADVANCED_ROUTE, SET_ASIDE_HEADING, describePlan } from '../../wizard/stepText';
import { WizardFrame, WorkingPanel, ErrorLine, ItemList } from './WizardFrame';

export interface StepScreenProps {
  plan: StepPlan;
  playerName: string;
  /** "Step 2 of 4". */
  position?: string;
  busy: boolean;
  progress: WizardProgress | null;
  error: string | null;
  onConfirm: () => void;
  onSkip: () => void;
  /** Leave a step that had only cases to check by hand. */
  onContinue: () => void;
  onCancel: () => void;
  onOpenAdvanced: (path: string) => void;
}

/**
 * One generic screen for every step: what will happen, with the count and the
 * list, the cases the wizard will not decide, and one confirm. Nothing changes
 * that this screen did not show first.
 */
export const StepScreen: React.FC<StepScreenProps> = ({
  plan, playerName, position, busy, progress, error, onConfirm, onSkip, onContinue, onCancel, onOpenAdvanced,
}) => {
  const text = describePlan(plan, playerName);
  const empty = isEmptyPlan(plan);
  // Nothing planned because the step cannot run: say why, and let it be skipped, not finished.
  const blockedEmpty = empty && !!text.blocked;
  const advanced = ADVANCED_ROUTE[plan.step];

  let lead: React.ReactNode = text.lead;
  if (blockedEmpty) {lead = "This step can't run right now.";}
  else if (empty) {lead = 'Nothing here can be fixed without you. These are listed so you can look at them.';}

  const actions = busy ? undefined : blockedEmpty ? (
    <button type="button" className="btn-primary" onClick={onSkip}>Skip this step</button>
  ) : empty ? (
    <button type="button" className="btn-primary" onClick={onContinue}>Continue</button>
  ) : (
    <>
      <button type="button" className="btn-primary" onClick={onConfirm} disabled={!!text.blocked}>
        {text.confirmLabel}
      </button>
      <button type="button" className="btn-ghost" onClick={onSkip}>Skip this step</button>
    </>
  );

  return (
    <WizardFrame
      title={text.title}
      position={position}
      lead={lead}
      actions={actions}
    >
      {!empty && <ItemList items={text.items} label="What will change" />}
      {text.blocked && <ErrorLine message={text.blocked} />}

      {text.setAside.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-te-display text-sm font-semibold text-te-grey-800">{SET_ASIDE_HEADING}</h3>
            <button
              type="button"
              className="btn-ghost text-xs flex items-center gap-1"
              onClick={() => onOpenAdvanced(advanced.path)}
            >
              <ExternalLink className="w-3 h-3" />
              {advanced.label}
            </button>
          </div>
          <p className="text-xs font-te-mono normal-case text-te-grey-500">
            {plan.step === 'gather'
              ? 'These stay where they are this time.'
              : 'The wizard leaves these alone. They are not changed by this step.'}
          </p>
          <ItemList items={text.setAside} label={SET_ASIDE_HEADING} />
        </section>
      )}

      {busy && <WorkingPanel progress={progress} fallback="Working…" onCancel={onCancel} />}
      <ErrorLine message={error} />
    </WizardFrame>
  );
};
