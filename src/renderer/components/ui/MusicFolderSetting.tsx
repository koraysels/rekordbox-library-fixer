import React, { useCallback } from 'react';
import { FolderOpen } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';

/**
 * Open the folder picker and keep the answer as the music folder. Returns the
 * folder chosen, or null when the picker was closed without one.
 */
export function useChooseMusicFolder(): () => Promise<string | null> {
  const setMusicFolder = useSettingsStore((s) => s.setMusicFolder);
  return useCallback(async () => {
    try {
      const folder = await window.electronAPI.selectFolder();
      if (!folder) {return null;}
      setMusicFolder(folder);
      return folder;
    } catch {
      return null;
    }
  }, [setMusicFolder]);
}

/**
 * The music folder as a setting: shown, and changeable, from Settings in either
 * mode. The wizard gathers into it and both the wizard and the Relocate page
 * look there first for moved tracks.
 */
export const MusicFolderSetting: React.FC = () => {
  const musicFolder = useSettingsStore((s) => s.musicFolder);
  const choose = useChooseMusicFolder();
  return (
    <div className="space-y-1">
      <span className="block font-medium text-te-grey-800">Music folder</span>
      <div className="flex items-center gap-2">
        <p
          className="flex-1 min-w-0 truncate te-path text-xs text-te-grey-700"
          title={musicFolder || undefined}
          data-testid="music-folder-path"
        >
          {musicFolder || 'Not chosen yet'}
        </p>
        <button
          type="button"
          className="btn-secondary flex items-center gap-1 text-xs"
          onClick={() => void choose()}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          {musicFolder ? 'Change' : 'Choose'}
        </button>
      </div>
      <p className="text-sm text-te-grey-600 font-te-mono">
        Where your tracks live. Moved tracks are looked for here first, and the wizard moves files from elsewhere into it
      </p>
    </div>
  );
};
