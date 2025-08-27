import React from 'react';
import { Download } from 'lucide-react';

export const ImportPage: React.FC = () => {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-lg">
        <div className="bg-gray-800 rounded-2xl p-8">
          <div className="w-12 h-12 bg-rekordbox-purple/20 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Download className="w-6 h-6 text-rekordbox-purple" />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">Auto Import</h2>
          <p className="text-zinc-400 leading-relaxed">
            Feature coming soon: Automatically import new tracks while preventing duplicates
          </p>
        </div>
      </div>
    </div>
  );
};