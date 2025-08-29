import React from 'react';
import { Wrench } from 'lucide-react';

export const MaintenancePage: React.FC = () => {
  return (
    <div className="h-full flex items-center justify-center bg-te-grey-100">
      <div className="text-center max-w-lg">
        <div className="card p-8">
          <div className="w-12 h-12 bg-te-orange/20 rounded-te-lg flex items-center justify-center mx-auto mb-4">
            <Wrench className="w-6 h-6 text-te-orange" />
          </div>
          <h2 className="te-title mb-3">Library Maintenance</h2>
          <p className="te-value leading-relaxed font-te-mono">
            Feature coming soon: Find orphan tracks, repair files, and optimize your library
          </p>
        </div>
      </div>
    </div>
  );
};