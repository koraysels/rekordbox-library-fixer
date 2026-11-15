import { describe, it, expect } from 'vitest';
import { wizardSidebarItems, type WizardProgressInput } from '@renderer/wizard/wizardProgress';
import type { WizardCheck } from '../../src/main/wizard/types';

const check: WizardCheck = {
  libraryPath: '/lib/master.db', checkedAt: '2026-11-15T10:00:00Z',
  missing: 3, duplicates: 0, outsideFolder: 7, unplayable: 2, unpluggedDrives: [],
};

const base: WizardProgressInput = {
  screen: 'summary', phase: 'summary', setupDone: true, check,
  runSteps: ['relocate', 'remove', 'gather', 'convert'], done: [], skipped: [], nextStep: undefined,
};

const states = (input: WizardProgressInput) =>
  Object.fromEntries(wizardSidebarItems(input).map((i) => [i.id, i.state]));

describe('the wizard step list', () => {
  it('lists every step in order, setup to finish', () => {
    expect(wizardSidebarItems(base).map((i) => i.id)).toEqual(
      ['setup', 'check', 'relocate', 'remove', 'duplicates', 'gather', 'convert', 'finish'],
    );
  });

  it('during setup only setup is current and nothing is known about the steps', () => {
    const s = states({ ...base, screen: 'setup', setupDone: false });
    expect(s.setup).toBe('current');
    expect(s.check).toBe('upcoming');
    expect(s.duplicates).toBe('upcoming');
  });

  it('on the summary, check is current and a step with nothing to do says so', () => {
    const s = states(base);
    expect(s.setup).toBe('done');
    expect(s.check).toBe('current');
    expect(s.relocate).toBe('upcoming');
    expect(s.duplicates).toBe('nothing');
  });

  it('carries the count the check found', () => {
    const items = wizardSidebarItems(base);
    expect(items.find((i) => i.id === 'gather')?.count).toBe(7);
    expect(items.find((i) => i.id === 'duplicates')?.count).toBeUndefined();
  });

  it('while stepping, marks done, skipped and the current step', () => {
    const s = states({
      ...base, screen: 'step', phase: 'steps', done: ['relocate'], skipped: ['remove'], nextStep: 'gather',
    });
    expect(s.check).toBe('done');
    expect(s.relocate).toBe('done');
    expect(s.remove).toBe('skipped');
    expect(s.gather).toBe('current');
    expect(s.convert).toBe('upcoming');
    expect(s.finish).toBe('upcoming');
  });

  it('the close-rekordbox gate between steps keeps the step it waits on current', () => {
    expect(states({ ...base, screen: 'close', phase: 'steps', nextStep: 'convert' }).convert).toBe('current');
  });

  it('at the end, finish is current', () => {
    const s = states({
      ...base, screen: 'done', phase: 'steps', done: ['relocate', 'remove', 'gather', 'convert'],
    });
    expect(s.finish).toBe('current');
    expect(s.convert).toBe('done');
  });
});
