import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './routes';
import { historyStorage } from './db/historyDb';
import './index.css';

// Simple test function for console debugging
(window as any).testHistoryDB = async () => {
  console.log('🧪 Testing history database...');
  
  // Test adding an entry
  const testEntry = {
    libraryPath: '/test/library.xml',
    trackId: 'test-123',
    trackName: 'Test Track',
    trackArtist: 'Test Artist',
    originalLocation: '/old/track.mp3',
    newLocation: '/new/track.mp3',
    relocationMethod: 'manual' as const,
    timestamp: new Date(),
    xmlUpdated: true,
    backupCreated: true
  };
  
  await historyStorage.addRelocationEntry(testEntry);
  console.log('✅ Test entry added');
  
  // Test retrieving entries
  const history = await historyStorage.getRelocationHistory('/test/library.xml');
  console.log(`📋 Found ${history.length} entries:`, history);
  
  return history;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
