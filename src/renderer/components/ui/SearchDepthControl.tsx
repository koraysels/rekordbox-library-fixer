import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';

export const MIN_DEPTH = 1;
export const MAX_DEPTH = 10;

/**
 * How many folder levels below each search path the relocator looks. It lived
 * only in the settings slideout, so a file one level too deep was simply "not
 * found" with nothing on the page suggesting why.
 */
export const SearchDepthControl: React.FC<{ dark?: boolean }> = ({ dark = false }) => {
  const depth = useSettingsStore((s) => s.relocationOptions.searchDepth);
  const update = useSettingsStore((s) => s.updateRelocationOption);
  const set = (value: number) =>
    update('searchDepth', Math.min(MAX_DEPTH, Math.max(MIN_DEPTH, value)));

  const button = dark
    ? 'p-1 rounded-te border border-te-grey-600 text-te-cream hover:border-te-orange disabled:opacity-40'
    : 'p-1 rounded-te border border-te-grey-300 bg-te-cream hover:border-te-orange disabled:opacity-40';

  return (
    <div className={`inline-flex items-center gap-2 text-xs font-te-mono ${dark ? 'text-te-grey-400' : 'te-label'}`}>
      <span>Search depth</span>
      <button type="button" aria-label="Search fewer folder levels" className={button}
        disabled={depth <= MIN_DEPTH} onClick={() => set(depth - 1)}>
        <Minus size={12} />
      </button>
      <span className={`min-w-[1.5rem] text-center ${dark ? 'text-te-cream' : 'te-value'}`} aria-live="polite">{depth}</span>
      <button type="button" aria-label="Search more folder levels" className={button}
        disabled={depth >= MAX_DEPTH} onClick={() => set(depth + 1)}>
        <Plus size={12} />
      </button>
      <span>folder levels</span>
    </div>
  );
};
