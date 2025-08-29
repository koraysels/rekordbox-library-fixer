import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

interface SplashScreenProps {
  isLoading?: boolean;
  message?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  isLoading = true,
  message = 'Loading Rekordbox Library Fixer...'
}) => {
  const version = useAppStore((state) => state.version);
  const loadVersion = useAppStore((state) => state.loadVersion);

  useEffect(() => {
    loadVersion();
  }, [loadVersion]);
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-te-black via-te-grey-800 to-te-black flex items-center justify-center z-50">
      <div className="text-center">
        {/* Logo and title */}
        <div className="flex items-center justify-center space-x-3 mb-8">
          <div className="relative">
            <img
              src="./logo.png"
              alt="Rekordbox Library Fixer"
              className="w-12 h-12 bg-white rounded-xl p-1 shadow-lg"
            />
            <div className="absolute -inset-2 bg-te-orange/20 rounded-full blur-lg animate-pulse"></div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-te-cream font-te-display uppercase">Rekordbox Library Fixer</h1>
            <p className="text-te-cream text-sm font-te-mono">Fix and optimize your DJ library</p>
          </div>
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center justify-center space-x-3 mb-6">
            <Loader2 className="w-6 h-6 text-te-orange animate-spin spinner-loading" />
            <span className="text-te-cream text-sm font-te-mono">{message}</span>
          </div>
        )}

        {/* Progress bar */}
        <div className="w-64 h-1 bg-te-grey-800 rounded-full overflow-hidden mx-auto">
          <div className="h-full bg-gradient-to-r from-te-orange to-te-grey-400 rounded-full animate-pulse"></div>
        </div>

        {/* Version info */}
        <div className="mt-8 text-center">
          <p className="text-te-grey-500 text-xs font-te-mono">Version {version}</p>
          <p className="text-te-grey-600 text-xs mt-1 font-te-mono">© 2025 Koray Sels</p>
        </div>
      </div>
    </div>
  );
};
