import React from 'react';
import { Download } from 'lucide-react';

export const ImportPage: React.FC = () => {
  return (
    <div className="h-full flex items-center justify-center bg-te-grey-100">
      <div className="text-center max-w-lg">
        <div className="card p-8">
          <div className="w-12 h-12 bg-te-orange/20 rounded-te-lg flex items-center justify-center mx-auto mb-4">
            <Download className="w-6 h-6 text-te-orange" />
          </div>
          <h2 className="te-title mb-3">Auto Import</h2>
          <p className="te-value leading-relaxed font-te-mono">
            Feature coming soon: Automatically import new tracks while preventing duplicates
          </p>
        </div>
      </div>
    </div>
  );
};