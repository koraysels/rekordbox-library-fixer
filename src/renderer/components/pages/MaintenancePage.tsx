import React from 'react';
import { Wrench } from 'lucide-react';
import { PageHeader } from '../ui';
import { useAppContext } from '../../AppWithRouter';
import { BrokenEntriesPanel } from '../BrokenEntriesPanel';
import { ConsolidatePanel } from '../maintenance/ConsolidatePanel';
import { FilterMovePanel } from '../maintenance/FilterMovePanel';

/**
 * Three independent tools, each owning its own state: clearing out entries that
 * can never resolve to a file, gathering the library onto one drive, and moving
 * a filtered part of it. They lived in one file and shared nothing but a scroll
 * bar, with the second tool's state distinguished only by an "f" prefix.
 */
export const MaintenancePage: React.FC = () => {
  const { libraryData, libraryPath } = useAppContext();
  const tracks = libraryData ? Array.from(libraryData.tracks.values()) : [];
  const hasLibrary = tracks.length > 0;

  return (
    <div className="p-te-lg h-full overflow-auto">
      <PageHeader title="Maintenance" icon={Wrench} />

      <div className="px-4 pt-4">
        <BrokenEntriesPanel />
      </div>

      <ConsolidatePanel tracks={tracks} libraryPath={libraryPath} hasLibrary={hasLibrary} />
      <FilterMovePanel tracks={tracks} libraryPath={libraryPath} hasLibrary={hasLibrary} />

      <div className="bg-white rounded-te shadow-sm p-te-md mt-te-md opacity-50">
        <h3 className="font-semibold text-te-grey-800 mb-1">Coming soon</h3>
        <ul className="text-sm text-te-grey-500 font-te-mono space-y-1 list-disc list-inside">
          <li>Find and remove orphan tracks</li>
          <li>Repair broken file references</li>
          <li>Optimise and clean up library metadata</li>
        </ul>
      </div>
    </div>
  );
};
