import React from 'react';
import { Loader2, Search, Eye, Play } from 'lucide-react';
import { PLAYER_PROFILES, describeReason } from '../../../main/convert/playerProfiles';
import { useConverter } from '../../hooks/useConverter';
import { candidateKey, isConvertible } from '../../convert/reasons';
import { ConvertStatus } from './ConvertStatus';
import { ConvertProgressDialog } from './ConvertProgressDialog';
import { ConvertResultSummary } from './ConvertResultSummary';
import type { LibraryData, ShowNotification } from '../../types';
import type { TargetFormat } from '../../../main/ipcContract';

export const MP3_WARNING = 'MP3 is lossy, and its encoder delay can move cues by a few milliseconds.';
export const XML_NOTICE = "Importing this XML into rekordbox adds the converted files as new tracks without cues — rekordbox can't switch an existing track from an XML. Open the rekordbox database to switch tracks in place.";

const TARGETS: Array<{ id: TargetFormat; label: string }> = [
  { id: 'aiff', label: 'AIFF' },
  { id: 'wav', label: 'WAV' },
  { id: 'mp3', label: 'MP3' },
];

interface Props {
  libraryData: LibraryData | null;
  libraryPath: string;
  showNotification: ShowNotification;
  setLibraryData: React.Dispatch<React.SetStateAction<LibraryData | null>>;
  /** Where "file not reachable" is fixed. */
  onOpenRelocation?: () => void;
}

export const ConvertPanel: React.FC<Props> = ({ libraryData, libraryPath, showNotification, setLibraryData, onOpenRelocation }) => {
  const c = useConverter({ libraryData, libraryPath, showNotification, setLibraryData });

  if (!libraryData || !libraryPath) {
    return <p className="p-4 text-sm font-te-mono normal-case text-te-grey-600">Load a library first to find tracks your player cannot play.</p>;
  }

  const conflicts = c.preview?.filter((i) => i.readiness === 'conflict').length ?? 0;
  const convertible = (c.preview ?? []).filter((i) => i.readiness !== 'conflict');
  const trackCount = convertible.reduce((n, i) => n + i.trackIds.length, 0);
  const missingMb = c.ffmpeg?.state === 'missing' ? Math.round(c.ffmpeg.sizeBytes / (1024 * 1024)) : 0;

  let convertLabel = `Convert ${trackCount} track${trackCount === 1 ? '' : 's'}`;
  if (c.ffmpeg?.state === 'missing') { convertLabel = `Download ffmpeg (${missingMb} MB) and convert`; }
  const canConvert = !!c.preview && convertible.length > 0 && !c.running
    && (c.ffmpeg?.state === 'ready' || c.ffmpeg?.state === 'missing');

  return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      <ConvertStatus running={c.running && !c.showProgress} progress={c.progress} installPercent={c.installPercent} onShow={() => c.setShowProgress(true)} />
      {/* Keyed by run: the dialog stays mounted between runs, and a cancelled run's state must not carry over. */}
      <ConvertProgressDialog
        key={c.runNumber}
        isOpen={c.running && c.showProgress} progress={c.progress} installPercent={c.installPercent}
        onHide={() => c.setShowProgress(false)} onCancel={() => void c.cancel()}
      />

      <section className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="te-label">Player</span>
          <select className="input" value={c.profileId} onChange={(e) => c.chooseProfile(e.target.value as typeof c.profileId)}>
            {Object.values(PLAYER_PROFILES).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => void c.scan()} disabled={c.scanning || c.running}>
          {c.scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Scan library
        </button>
      </section>

      <section className="space-y-2">
        <fieldset className="flex items-center gap-4">
          <legend className="te-label mb-1">Convert to</legend>
          {TARGETS.map((t) => (
            <label key={t.id} className="flex items-center gap-1 text-sm font-te-mono">
              <input type="radio" name="convert-target" checked={c.target === t.id} onChange={() => c.chooseTarget(t.id)} />
              {t.label}
            </label>
          ))}
        </fieldset>
        {c.target === 'mp3' && <p className="text-xs font-te-mono normal-case text-te-amber-500">{MP3_WARNING}</p>}

        {c.database ? (
          <label className="flex items-center gap-2 text-sm font-te-mono">
            <input type="checkbox" className="checkbox" checked={c.trashOriginals} onChange={(e) => c.setTrashOriginals(e.target.checked)} />
            Move originals to Trash after switching
          </label>
        ) : (
          <p className="text-xs font-te-mono normal-case text-te-grey-600">{XML_NOTICE}</p>
        )}
      </section>


      {c.scanned && c.candidates.length === 0 && (
        <p className="text-sm font-te-mono normal-case te-value">Every track in this library plays on that player.</p>
      )}

      {c.candidates.length > 0 && (
        <>
          <section className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="te-label">Reason</span>
              <select className="input" aria-label="Filter by reason" value={c.reasonFilter} onChange={(e) => c.setReasonFilter(e.target.value)}>
                <option value="">All reasons ({c.candidates.length})</option>
                {c.reasons.map((r) => <option key={r.label} value={r.label}>{r.label} ({r.count})</option>)}
              </select>
            </label>
            <button type="button" className="btn-secondary text-xs" onClick={c.selectAllVisible}>Select all</button>
            <button type="button" className="btn-secondary text-xs" onClick={c.clearSelection}>Clear</button>
            <span className="te-label">{c.selectedCandidates.length} selected</span>
          </section>

          <ul className="border-2 border-te-grey-300 rounded-te divide-y divide-te-grey-200 max-h-80 overflow-y-auto bg-te-cream">
            {c.visible.map((cand) => {
              const ok = isConvertible(cand);
              return (
                <li key={candidateKey(cand)} className={`flex items-start gap-3 px-3 py-2 ${ok ? '' : 'opacity-60'}`}>
                  <input
                    type="checkbox" className="checkbox mt-1"
                    aria-label={`${cand.artist} ${cand.name}`.trim()}
                    checked={c.selected.has(candidateKey(cand))} disabled={!ok} onChange={() => c.toggle(cand)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-te-grey-800 truncate">{cand.name}</p>
                    <p className="text-xs font-te-mono normal-case text-te-grey-600 truncate">{cand.artist}</p>
                    {ok ? (
                      <p className="text-xs font-te-mono normal-case text-te-grey-600">
                        {cand.reasons.map((r, i) => <span key={i} className="mr-3">{describeReason(r)}</span>)}
                      </p>
                    ) : cand.unreadable ? (
                      <p className="text-xs font-te-mono normal-case text-te-red-500">
                        couldn&apos;t read the file — it is there, but its audio could not be read
                      </p>
                    ) : (
                      <p className="text-xs font-te-mono normal-case text-te-red-500">
                        file not reachable — fix it with{' '}
                        {onOpenRelocation
                          ? <button type="button" className="underline" onClick={onOpenRelocation}>Track Relocation</button>
                          : 'Track Relocation'} first
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <section className="flex items-center gap-3">
            <button
              type="button" className="btn-secondary flex items-center gap-2"
              disabled={c.selectedCandidates.length === 0 || c.previewing || c.running} onClick={() => void c.runPreview()}
            >
              {c.previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Preview
            </button>
            <button type="button" className="btn-primary flex items-center gap-2" disabled={!canConvert} onClick={() => void c.run()}>
              <Play className="w-4 h-4" />
              {convertLabel}
            </button>
            {c.ffmpeg?.state === 'unsupported' && (
              <span className="text-xs font-te-mono normal-case text-te-red-500">ffmpeg is not available for this system.</span>
            )}
          </section>
        </>
      )}

      {c.preview && (
        <section className="space-y-1">
          <h3 className="te-label">Preview</h3>
          <ul className="border-2 border-te-grey-300 rounded-te divide-y divide-te-grey-200 max-h-64 overflow-y-auto bg-te-cream">
            {c.preview.map((item) => (
              <li key={item.from} className="px-3 py-2 text-xs font-te-mono normal-case break-all">
                <span className="text-te-grey-600">{item.from}</span>
                <span className="text-te-orange"> → </span>
                <span>{item.to}</span>
                {/* Every entry pointing at the file switches with it: say so, so none comes as a surprise. */}
                {item.trackIds.length > 1 && <span className="ml-2 text-te-grey-500">{item.trackIds.length} entries</span>}
                {item.readiness === 'conflict' && <span className="ml-2 text-te-red-500">conflict — a different file already has that name; it is skipped</span>}
                {item.readiness === 'reusable' && <span className="ml-2 text-te-grey-500">already converted — reused</span>}
              </li>
            ))}
          </ul>
          {conflicts > 0 && <p className="text-xs font-te-mono normal-case text-te-red-500">{conflicts} conflict{conflicts === 1 ? '' : 's'} will be skipped.</p>}
        </section>
      )}

      {c.result && <ConvertResultSummary result={c.result} onDismiss={c.dismissResult} />}
    </div>
  );
};
