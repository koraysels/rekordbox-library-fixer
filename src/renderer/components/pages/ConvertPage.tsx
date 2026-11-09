import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { PageHeader } from '../ui';
import { useAppContext } from '../../AppWithRouter';
import { ConvertPanel } from '../convert/ConvertPanel';

/** Tracks the oldest player cannot play, converted to a format it can, and the library switched over. */
export const ConvertPage: React.FC = () => {
  const { libraryData, libraryPath, showNotification, setLibraryData } = useAppContext();
  const navigate = useNavigate();
  return (
    <div className="p-te-lg h-full overflow-auto">
      <PageHeader title="Convert" icon={RefreshCw} />
      <ConvertPanel
        libraryData={libraryData}
        libraryPath={libraryPath}
        showNotification={showNotification}
        setLibraryData={setLibraryData}
        onOpenRelocation={() => void navigate({ to: '/relocate' })}
      />
    </div>
  );
};
