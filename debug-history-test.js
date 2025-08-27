// Test script to check if history database is working
// Run this in browser console

// Test function to add a sample history entry
async function testHistoryDatabase() {
  try {
    console.log('🧪 Testing history database...');
    
    // Import the historyStorage
    const { historyStorage } = await import('./src/renderer/db/historyDb');
    
    console.log('📦 historyStorage imported:', historyStorage);
    
    // Test adding an entry
    const testEntry = {
      libraryPath: '/test/path/library.xml',
      trackId: 'test-track-123',
      trackName: 'Test Track',
      trackArtist: 'Test Artist', 
      originalLocation: '/old/path/track.mp3',
      newLocation: '/new/path/track.mp3',
      relocationMethod: 'manual',
      timestamp: new Date(),
      xmlUpdated: true,
      backupCreated: true
    };
    
    console.log('💾 Adding test entry:', testEntry);
    await historyStorage.addRelocationEntry(testEntry);
    console.log('✅ Test entry added successfully');
    
    // Test retrieving entries
    console.log('🔍 Retrieving history entries...');
    const history = await historyStorage.getRelocationHistory('/test/path/library.xml');
    console.log('📋 Retrieved history:', history);
    
    console.log('🧪 Test completed successfully!');
    return history;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testHistoryDatabase();