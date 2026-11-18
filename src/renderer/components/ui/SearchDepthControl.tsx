import React from 'react';
import { Minus, Plus } from 'lucide-react';
import {
  NumberInput,
  NumberInputControl,
  NumberInputDecrement,
  NumberInputGroup,
  NumberInputIncrement,
} from '@ui-sdk/react/number-input';
import { useSettingsStore } from '../../stores/settingsStore';

export const MIN_DEPTH = 1;
export const MAX_DEPTH = 10;

export const useSearchDepth = () => {
  const depth = useSettingsStore((s) => s.relocationOptions.searchDepth);
  const update = useSettingsStore((s) => s.updateRelocationOption);
  const set = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return;
    update('searchDepth', Math.min(MAX_DEPTH, Math.max(MIN_DEPTH, Math.round(value))));
  };
  return [depth, set] as const;
};

// It lived only in the settings slideout, so a file one level too deep was
// simply "not found" with nothing on the page suggesting why.
export const SearchDepthControl: React.FC<{ dark?: boolean }> = ({ dark = false }) => {
  const [depth, set] = useSearchDepth();

  const button = dark
    ? 'p-1 rounded-te border border-te-grey-600 text-te-cream hover:border-te-orange data-disabled:opacity-40'
    : 'p-1 rounded-te border border-te-grey-300 bg-te-cream hover:border-te-orange data-disabled:opacity-40';

  return (
    <NumberInput
      value={depth}
      min={MIN_DEPTH}
      max={MAX_DEPTH}
      onValueChange={set}
      className={`inline-flex flex-row items-center gap-2 text-xs font-te-mono ${dark ? 'text-te-grey-400' : 'te-label'}`}
    >
      <span>Search depth</span>
      <NumberInputGroup className="inline-flex items-center gap-2">
        <NumberInputDecrement aria-label="Search fewer folder levels" className={button}>
          <Minus size={12} aria-hidden="true" />
        </NumberInputDecrement>
        <NumberInputControl
          aria-label="Search depth"
          className={`w-6 text-center ${dark ? 'text-te-cream' : 'te-value'}`}
        />
        <NumberInputIncrement aria-label="Search more folder levels" className={button}>
          <Plus size={12} aria-hidden="true" />
        </NumberInputIncrement>
      </NumberInputGroup>
      <span>folder levels</span>
    </NumberInput>
  );
};
