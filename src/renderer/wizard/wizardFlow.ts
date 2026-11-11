/**
 * Which wizard steps a check calls for, and whether a plan has anything to do.
 * Pure, so the sequence can be tested without rendering a screen.
 */
import { STEP_ORDER, type StepPlan, type WizardCheck, type WizardStepId } from '../../main/wizard/types';

/** What each step needs to be worth running. Missing tracks bring both relocate and remove. */
const NEEDED: Record<WizardStepId, (check: WizardCheck) => boolean> = {
  relocate: (c) => c.missing > 0,
  remove: (c) => c.missing > 0,
  duplicates: (c) => c.duplicates > 0,
  gather: (c) => c.outsideFolder > 0,
  convert: (c) => c.unplayable > 0,
};

/** The steps a check calls for, in the fixed order; steps with nothing to do are left out. */
export function stepsFor(check: WizardCheck): WizardStepId[] {
  return STEP_ORDER.filter((step) => NEEDED[step](check));
}

/**
 * Nothing to apply. A set-aside list may still be there: the step is then shown
 * only as "check these yourself", with a Continue button and no write.
 */
export function isEmptyPlan(plan: StepPlan): boolean {
  switch (plan.step) {
    case 'relocate': return plan.apply.length === 0;
    case 'remove': return plan.remove.length === 0;
    case 'duplicates': return !plan.merges.some((m) => m.removeIds.length > 0);
    case 'gather': return plan.moves.length === 0;
    case 'convert': return plan.items.length === 0;
  }
}
