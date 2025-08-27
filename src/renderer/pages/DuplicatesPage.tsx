import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { db } from '../db/duplicatesDb';
import { useSettingsStore } from '../stores/settingsStore';
import { DuplicateDetector } from '../components/DuplicateDetector';
import { Skeleton } from '../components/ui/Skeleton';

export function DuplicatesPage() {
  // Get cached results from Dexie
  const cachedResults = useLiveQuery(
    async () => {
      const paths = await db.getAllLibraryPaths();
      if (paths.length > 0) {
        return await db.getDuplicateResult(paths[0]);
      }
      return null;
    }
  );
  
  // Get settings from Zustand
  const { scanOptions } = useSettingsStore();
  
  // Loading state with skeleton
  if (cachedResults === undefined) {
    return <DuplicatesPageSkeleton />;
  }
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full p-6"
    >
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            Duplicate Detection
          </h1>
          <p className="text-gray-400">
            Find and resolve duplicate tracks in your Rekordbox library
          </p>
        </div>
        
        <div className="bg-gray-800 rounded-lg shadow-xl">
          <DuplicateDetector
            initialData={cachedResults}
            scanOptions={scanOptions}
          />
        </div>
      </div>
    </motion.div>
  );
}

function DuplicatesPageSkeleton() {
  return (
    <div className="h-full p-6">
      <div className="max-w-7xl mx-auto">
        <Skeleton className="h-10 w-64 mb-2" />
        <Skeleton className="h-5 w-96 mb-6" />
        <div className="bg-gray-800 rounded-lg shadow-xl p-6">
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}