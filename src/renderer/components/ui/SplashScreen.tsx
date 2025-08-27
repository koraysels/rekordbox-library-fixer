import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

interface SplashScreenProps {
  isLoading?: boolean;
  message?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  isLoading = true,
  message = 'Loading Rekordbox Library Manager...'
}) => {
  const version = useAppStore((state) => state.version);
  const loadVersion = useAppStore((state) => state.loadVersion);

  useEffect(() => {
    loadVersion();
  }, [loadVersion]);
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-rekordbox-dark via-zinc-900 to-rekordbox-dark flex items-center justify-center z-50">
      <div className="text-center">
        {/* Logo and title */}
        <div className="flex items-center justify-center space-x-3 mb-8">
          <div className="relative">
            <img
              src="./logo.png"
              alt="Rekordbox Library Manager"
              className="w-12 h-12 bg-white rounded-xl p-1 shadow-lg"
            />
            <div className="absolute -inset-2 bg-rekordbox-purple/20 rounded-full blur-lg animate-pulse"></div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Rekordbox Library Manager</h1>
            <p className="text-purple-300 text-sm">Fix and optimize your DJ library</p>
          </div>
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center justify-center space-x-3 mb-6">
            <Loader2 className="w-6 h-6 text-rekordbox-purple animate-spin spinner-loading" />
            <span className="text-white text-sm">{message}</span>
          </div>
        )}

        {/* Progress bar */}
        <div className="w-64 h-1 bg-zinc-800 rounded-full overflow-hidden mx-auto">
          <div className="h-full bg-gradient-to-r from-rekordbox-purple to-purple-400 rounded-full animate-pulse"></div>
        </div>

        {/* Version info */}
        <div className="mt-8 text-center">
          <p className="text-zinc-500 text-xs">Version {version}</p>
          <p className="text-zinc-600 text-xs mt-1">© 2025 Koray Sels</p>
        </div>
      </div>
    </div>
  );
};
