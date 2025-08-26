const { _electron: electron } = require('playwright');
const fs = require('fs');
const path = require('path');

async function takeScreenshots() {
  console.log('Launching Electron app...');
  const app = await electron.launch({
    args: ['dist/main/main.js'],
    cwd: process.cwd()
  });

  const page = await app.firstWindow();
  
  // Wait for app to be ready and skip splash screen
  await page.waitForLoadState('networkidle');
  console.log('Waiting for splash screen to finish...');
  await page.waitForTimeout(3000); // Wait for splash to disappear
  
  // Wait for main app to load
  await page.waitForSelector('img[alt="Rekordbox Library Manager"]', { timeout: 10000 });
  
  console.log('1. Taking main interface screenshot (empty state)...');
  await page.screenshot({ 
    path: 'screenshots/main-interface.png', 
    fullPage: false 
  });
  
  // Load library via direct file operations (simulating the IPC more effectively)
  const testLibraryPath = path.join(process.cwd(), 'temp-test-library.xml');
  const sourceLibrary = path.join(process.cwd(), 'tests/fixtures/library-with-duplicates.xml');
  
  // Copy the duplicates library for better demo
  fs.copyFileSync(sourceLibrary, testLibraryPath);
  
  // Click Select Library
  console.log('2. Clicking Select Library...');
  await page.click('button:has-text("Select Library")');
  await page.waitForTimeout(500);
  
  // Try to trigger the library loading more directly through the React component
  console.log('3. Loading library through React state...');
  await page.evaluate(async (libraryPath) => {
    try {
      // Parse the library
      const library = await window.electronAPI.parseRekordboxLibrary(libraryPath);
      console.log('Library parsed:', library);
      
      // Find React component instances and update state
      // This is a hack but should work for demo purposes
      const reactRoot = document.querySelector('#root');
      if (reactRoot && reactRoot._reactInternalFiber) {
        console.log('Found React root, attempting state update...');
      }
      
      // Try to find and click any existing library state management
      // Let's also try to trigger a window event that the app might be listening for
      const event = new CustomEvent('playwright-library-loaded', {
        detail: { library, path: libraryPath }
      });
      window.dispatchEvent(event);
      
      // Also try to call any exposed methods
      if (window.appStateUpdate) {
        window.appStateUpdate({ library, path: libraryPath });
      }
      
      return { success: true, tracks: library.tracks.length };
    } catch (error) {
      console.error('Failed to load library:', error);
      return { success: false, error: error.message };
    }
  }, testLibraryPath);
  
  await page.waitForTimeout(2000);
  
  // Take screenshot regardless to see current state
  console.log('4. Taking post-load screenshot...');
  await page.screenshot({ 
    path: 'screenshots/library-state.png', 
    fullPage: false 
  });
  
  // Now try to go to different tabs and get content
  try {
    console.log('5. Attempting to click Duplicate Detection tab...');
    await page.click('button:has-text("Duplicate Detection")');
    await page.waitForTimeout(1500);
    
    console.log('6. Taking duplicate detection screenshot...');
    await page.screenshot({ 
      path: 'screenshots/duplicate-detection.png', 
      fullPage: false 
    });
    
    // Try to click scan button if it exists
    try {
      const scanButton = page.locator('button:has-text("Scan for Duplicates")');
      if (await scanButton.count() > 0) {
        console.log('Found scan button, clicking...');
        await scanButton.click();
        await page.waitForTimeout(3000);
        
        console.log('7. Taking scan results screenshot...');
        await page.screenshot({ 
          path: 'screenshots/duplicate-results.png', 
          fullPage: false 
        });
      }
    } catch (error) {
      console.log('Could not click scan button:', error.message);
    }
  } catch (error) {
    console.log('Could not access duplicate detection:', error.message);
  }
  
  // Try Track Relocation tab
  try {
    console.log('8. Attempting Track Relocation tab...');
    // Force enable the tab by removing disabled attribute if present
    await page.evaluate(() => {
      const relocateButton = Array.from(document.querySelectorAll('button')).find(btn => 
        btn.textContent?.includes('Track Relocation')
      );
      if (relocateButton) {
        relocateButton.disabled = false;
        relocateButton.click();
      }
    });
    
    await page.waitForTimeout(1000);
    
    console.log('9. Taking track relocation screenshot...');
    await page.screenshot({ 
      path: 'screenshots/track-relocation.png', 
      fullPage: false 
    });
  } catch (error) {
    console.log('Could not access track relocation:', error.message);
  }
  
  console.log('Screenshots completed!');
  
  // Clean up temp file
  try {
    fs.unlinkSync(testLibraryPath);
  } catch (error) {
    console.log('Could not clean up temp file:', error.message);
  }
  
  await app.close();
}

takeScreenshots().catch(console.error);