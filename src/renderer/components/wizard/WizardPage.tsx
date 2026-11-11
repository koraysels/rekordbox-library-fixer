import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useAppContext } from '../../AppWithRouter';
import { useWizard } from '../../hooks/useWizard';
import { useSettingsStore } from '../../stores/settingsStore';
import { useWizardStore } from '../../wizard/wizardStore';
import { isEmptyPlan, stepsForRun } from '../../wizard/wizardFlow';
import { describePlan, stepTitle } from '../../wizard/stepText';
import { isDatabasePath, wizardScreen, type WizardPhase } from '../../wizard/wizardScreen';
import { PLAYER_PROFILES } from '../../../main/convert/playerProfiles';
import type { StepPlan, StepResult, WizardStepId } from '../../../main/wizard/types';
import { SetupScreen, type KeyRequest } from './SetupScreen';
import { useChooseMusicFolder } from '../ui/MusicFolderSetting';
import { XmlLibraryScreen } from './XmlLibraryScreen';
import { CloseRekordboxScreen } from './CloseRekordboxScreen';
import { SummaryScreen } from './SummaryScreen';
import { StepScreen } from './StepScreen';
import { ConvertConsent } from './ConvertConsent';
import { DoneScreen } from './DoneScreen';
import { WizardFrame, WorkingPanel, ErrorLine } from './WizardFrame';

/** The main process refuses a write while rekordbox runs; that sends the wizard back to the close screen. */
const refusedBecauseRunning = (r: StepResult) => !!r.error && /^close rekordbox/i.test(r.error);
const happened = (r: StepResult) => r.changed > 0 || !!r.backupPath || r.details.length > 0;
const wrote = (r: StepResult) => r.changed > 0 || !!r.backupPath;

/**
 * The wizard's sequencer: which screen shows, and what moves it on. Every
 * decision about a library lives in the main process and `../../wizard`; this
 * only walks the DJ through them, one thing per screen.
 */
export const WizardPage: React.FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const { libraryPath, libraryData, onLoadFromDb, onLoadLibrary, onSelectLibrary } = useAppContext();
  const navigate = useNavigate();
  const wizard = useWizard();
  const musicFolder = useSettingsStore((s) => s.musicFolder);
  const playerId = useSettingsStore((s) => s.oldestPlayer);
  const setAppMode = useSettingsStore((s) => s.setAppMode);
  const chooseMusicFolder = useChooseMusicFolder();
  const saved = useWizardStore((s) => s.byLibrary[libraryPath]);
  const markDone = useWizardStore((s) => s.markDone);
  const playerName = PLAYER_PROFILES[playerId]?.label ?? 'player';

  const [running, setRunning] = useState<boolean | null>(null);
  const [choosingDatabase, setChoosingDatabase] = useState(false);
  /** Kept here because loading a database unmounts the setup screen that asked. */
  const [keyRequest, setKeyRequest] = useState<KeyRequest | null>(null);
  const [phase, setPhase] = useState<WizardPhase>('summary');
  /** A check made in this visit; a saved one must be checked again before fixing. */
  const [fresh, setFresh] = useState(false);
  const [skipped, setSkipped] = useState<WizardStepId[]>([]);
  const [plan, setPlan] = useState<StepPlan | null>(null);
  const [planFailed, setPlanFailed] = useState<WizardStepId | null>(null);
  const [stepNote, setStepNote] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [results, setResults] = useState<StepResult[]>([]);
  /** Applying a step, or checking again after one: no next step is planned meanwhile. */
  const [settling, setSettling] = useState(false);
  const planningFor = useRef<WizardStepId | null>(null);

  const askRunning = useCallback(() => {
    void Promise.resolve(window.electronAPI.isRekordboxRunning())
      .then((r) => setRunning(!!r?.running))
      .catch(() => setRunning(false));
  }, []);
  useEffect(askRunning, [askRunning]);

  // Another library is another run.
  useEffect(() => {
    setChoosingDatabase(false);
    setKeyRequest(null);
    setPhase('summary');
    setFresh(false);
    setSkipped([]);
    setPlan(null);
    setPlanFailed(null);
    setStepNote(null);
    setResults([]);
  }, [libraryPath]);

  const steps = saved ? stepsForRun(saved.check, [...saved.done, ...skipped]) : [];
  const nextStep = phase === 'steps'
    ? steps.find((s) => !saved?.done.includes(s) && !skipped.includes(s))
    : undefined;

  const screen = wizardScreen({
    isLoading,
    libraryPath,
    hasLibrary: !!libraryData,
    musicFolder,
    choosingDatabase,
    rekordboxRunning: running,
    phase,
    nextStep,
  });

  // Plan the next step once its screen is due. The main process reads the
  // library afresh, so the plan reflects what the previous step wrote.
  useEffect(() => {
    if (screen !== 'step' || !nextStep || settling) {return;}
    if (plan?.step === nextStep || planningFor.current === nextStep || planFailed === nextStep) {return;}
    planningFor.current = nextStep;
    setPlan(null);
    void wizard.plan(nextStep).then((p) => {
      planningFor.current = null;
      if (!p) {setPlanFailed(nextStep);return;}
      if (isEmptyPlan(p) && describePlan(p, playerName).setAside.length === 0) {
        markDone(libraryPath, nextStep);
        return;
      }
      setPlan(p);
    });
  }, [screen, nextStep, settling, plan, planFailed, wizard, markDone, libraryPath, playerName]);

  const runCheck = async () => {
    const result = await wizard.check();
    if (!result) {return;}
    setFresh(true);
    setPhase('summary');
    setSkipped([]);
    setPlan(null);
    setPlanFailed(null);
    setStepNote(null);
    setResults([]);
  };

  // Another folder changes what is outside it: the last check no longer holds.
  const changeMusicFolder = async () => {
    const before = useSettingsStore.getState().musicFolder;
    const chosen = await chooseMusicFolder();
    if (chosen && chosen !== before) {setFresh(false);}
  };

  const start = () => {
    askRunning();
    setPhase('steps');
  };

  const leaveStep = (step: WizardStepId, done: boolean) => {
    if (done) {markDone(libraryPath, step);} else {setSkipped((s) => [...s, step]);}
    setPlan(null);
    setPlanFailed(null);
    setStepNote(null);
    setConsent(false);
  };

  const apply = async (p: StepPlan) => {
    setConsent(false);
    setStepNote(null);
    setSettling(true);
    try {
      const result = await wizard.apply(p);
      if (!result) {return;}
      if (happened(result)) {setResults((r) => [...r, result]);}
      if (refusedBecauseRunning(result) && !happened(result)) {
        setRunning(true);
        return;
      }
      // The library changed: check again, so the numbers follow it and a step
      // this one made necessary joins the run. A failed check leaves the old one.
      if (wrote(result)) {await wizard.recheck();}
      if (!result.error && !result.cancelled) {
        // The hook marked it done; the next step plans from the reloaded library.
        setPlan(null);
        return;
      }
      setStepNote(result.error ?? 'Stopped. What was already done is kept.');
      // Part of it may have been written: plan the step again from the library as it is now.
      if (happened(result)) {setPlan(null);}
    } finally {
      setSettling(false);
    }
  };

  const confirm = (p: StepPlan) => {
    if (p.step === 'convert' && p.ffmpeg.state === 'missing') {setConsent(true);return;}
    void apply(p);
  };

  const openAdvanced = (path: string) => {
    setAppMode('advanced');
    void navigate({ to: path });
  };

  switch (screen) {
    case 'loading':
      return (
        <div className="h-full flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-te-orange animate-spin" aria-label="Loading" />
        </div>
      );
    case 'setup':
      return (
        <SetupScreen
          hasDatabase={!!libraryData && isDatabasePath(libraryPath)}
          keyRequest={keyRequest}
          onKeyRequest={setKeyRequest}
          onLoadFromDb={onLoadFromDb}
          onLoadLibrary={onLoadLibrary}
          onSelectLibrary={onSelectLibrary}
        />
      );
    case 'xml':
      return <XmlLibraryScreen onOpenDatabase={() => setChoosingDatabase(true)} onAdvanced={() => setAppMode('advanced')} />;
    case 'close':
      return <CloseRekordboxScreen onClosed={() => setRunning(false)} />;
    case 'summary':
      return (
        <SummaryScreen
          check={saved?.check}
          fresh={fresh}
          playerName={playerName}
          musicFolder={musicFolder}
          onChangeMusicFolder={() => void changeMusicFolder()}
          busy={wizard.busy}
          progress={wizard.progress}
          error={wizard.error}
          onCheck={() => void runCheck()}
          onStart={start}
          onCancel={() => void wizard.cancel()}
        />
      );
    case 'done':
      return (
        <DoneScreen
          results={results}
          onCheckAgain={() => { setPhase('summary'); void runCheck(); }}
          onOpenHistory={() => openAdvanced('/history')}
        />
      );
    case 'step':
      break;
  }

  const step = nextStep as WizardStepId;
  const position = `Step ${steps.indexOf(step) + 1} of ${steps.length}`;

  if (consent && plan?.step === 'convert' && plan.ffmpeg.state === 'missing') {
    const convertPlan = plan;
    return (
      <ConvertConsent
        sizeBytes={plan.ffmpeg.sizeBytes}
        onInstalled={(path) => {
          // Installed now: a retry of this step must not ask again.
          const ready: StepPlan = { ...convertPlan, ffmpeg: { state: 'ready', path } };
          setPlan(ready);
          void apply(ready);
        }}
        onBack={() => setConsent(false)}
      />
    );
  }

  if (!plan || plan.step !== step) {
    const failed = planFailed === step;
    return (
      <WizardFrame
        title={stepTitle(step, playerName)}
        position={position}
        lead={failed ? 'This step could not be prepared.' : 'Looking at your library…'}
        actions={failed ? (
          <>
            <button type="button" className="btn-primary" onClick={() => setPlanFailed(null)}>Try again</button>
            <button type="button" className="btn-ghost" onClick={() => leaveStep(step, false)}>Skip this step</button>
          </>
        ) : undefined}
      >
        {!failed && <WorkingPanel progress={wizard.progress} fallback="Working…" onCancel={() => void wizard.cancel()} />}
        {failed && <ErrorLine message={wizard.error} />}
      </WizardFrame>
    );
  }

  return (
    <StepScreen
      plan={plan}
      playerName={playerName}
      position={position}
      busy={wizard.busy}
      progress={wizard.progress}
      error={stepNote ?? wizard.error}
      onConfirm={() => confirm(plan)}
      onSkip={() => leaveStep(step, false)}
      onContinue={() => leaveStep(step, true)}
      onCancel={() => void wizard.cancel()}
      onOpenAdvanced={openAdvanced}
    />
  );
};
