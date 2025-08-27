import React from 'react';
import { Wrench } from 'lucide-react';

export const MaintenancePage: React.FC = () => {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-lg">
        <div className="bg-gray-800 rounded-2xl p-8">
          <div className="w-12 h-12 bg-rekordbox-purple/20 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Wrench className="w-6 h-6 text-rekordbox-purple" />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">Library Maintenance</h2>
          <p className="text-zinc-400 leading-relaxed">
            Feature coming soon: Find orphan tracks, repair files, and optimize your library
          </p>
        </div>
      </div>
    </div>
  );
};