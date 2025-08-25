import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  selectRekordboxXML: () => ipcRenderer.invoke('select-rekordbox-xml'),
  parseRekordboxLibrary: (xmlPath: string) => 
    ipcRenderer.invoke('parse-rekordbox-library', xmlPath),
  findDuplicates: (options: any) => 
    ipcRenderer.invoke('find-duplicates', options),
  resolveDuplicates: (resolution: any) => 
    ipcRenderer.invoke('resolve-duplicates', resolution),
  saveRekordboxXML: (data: any) => 
    ipcRenderer.invoke('save-rekordbox-xml', data),
  getLogsInfo: () => ipcRenderer.invoke('get-logs-info'),
});

export {};
