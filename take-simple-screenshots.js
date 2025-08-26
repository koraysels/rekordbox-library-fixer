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
  await page.waitForTimeout(1000);
  
  console.log('1. Taking main interface screenshot (no library loaded)...');
  await page.screenshot({ 
    path: 'screenshots/main-interface.png', 
    fullPage: false 
  });
  
  // Now let's manually create a library state by copying the large library to a known location
  const testLibraryPath = path.join(process.cwd(), 'temp-test-library.xml');
  const sourceLibrary = path.join(process.cwd(), 'tests/fixtures/rekordbox-large-library.xml');
  
  // Copy the library file to a predictable location
  fs.copyFileSync(sourceLibrary, testLibraryPath);
  
  // Click "Select Library" button
  console.log('2. Clicking Select Library button...');
  await page.click('button:has-text("Select Library")');
  await page.waitForTimeout(500);
  
  // Since we can't interact with file dialogs in Playwright, let's use the IPC directly
  console.log('3. Loading library via IPC...');
  await page.evaluate(async (libraryPath) => {
    try {
      console.log('Calling parseRekordboxLibrary with path:', libraryPath);
      const library = await window.electronAPI.parseRekordboxLibrary(libraryPath);
      console.log('Library loaded successfully, tracks:', library.tracks?.length || 0);
      
      // Create a custom event to simulate library selection
      const event = new CustomEvent('test-library-loaded', {
        detail: { library, path: libraryPath }
      });
      window.dispatchEvent(event);
      
      // Manually trigger the library state update if there's a global app state
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        console.log('React DevTools detected, library should update');
      }
      
      return library;
    } catch (error) {
      console.error('Failed to load library:', error);
      throw error;
    }
  }, testLibraryPath);
  
  // Wait for the UI to update
  await page.waitForTimeout(3000);
  
  console.log('4. Taking library loaded screenshot...');
  await page.screenshot({ 
    path: 'screenshots/library-loaded.png', 
    fullPage: false 
  });
  
  // Try to click on different tabs by text content
  console.log('5. Looking for navigation tabs...');
  
  // Look for duplicate detection tab
  try {
    const duplicateTab = page.locator('button:has-text("Duplicate Detection")');
    if (await duplicateTab.count() > 0) {
      console.log('Found Duplicate Detection tab, clicking...');
      await duplicateTab.click();
      await page.waitForTimeout(1000);
      
      console.log('6. Taking duplicate detection screenshot...');
      await page.screenshot({ 
        path: 'screenshots/duplicate-detection.png', 
        fullPage: false 
      });
    } else {
      console.log('No Duplicate Detection tab found, checking for other elements...');
    }
  } catch (error) {
    console.log('Error clicking duplicate tab:', error.message);
  }
  
  // Look for track relocation tab
  try {
    const relocateTab = page.locator('button:has-text("Track Relocation")');
    if (await relocateTab.count() > 0) {
      console.log('Found Track Relocation tab, clicking...');
      await relocateTab.click();
      await page.waitForTimeout(1000);
      
      console.log('7. Taking track relocation screenshot...');
      await page.screenshot({ 
        path: 'screenshots/track-relocation.png', 
        fullPage: false 
      });
    }
  } catch (error) {
    console.log('Error clicking relocate tab:', error.message);
  }
  
  // Try the maintenance tab
  try {
    const maintenanceTab = page.locator('button:has-text("Maintenance")');
    if (await maintenanceTab.count() > 0) {
      console.log('Found Maintenance tab, clicking...');
      await maintenanceTab.click();
      await page.waitForTimeout(1000);
      
      console.log('8. Taking maintenance screenshot...');
      await page.screenshot({ 
        path: 'screenshots/maintenance.png', 
        fullPage: false 
      });
    }
  } catch (error) {
    console.log('Error clicking maintenance tab:', error.message);
  }
  
  console.log('Screenshots completed!');
  
  // Clean up temp file
  try {
    fs.unlinkSync(testLibraryPath);
    console.log('Cleaned up temporary library file');
  } catch (error) {
    console.log('Could not clean up temp file:', error.message);
  }
  
  await app.close();
}

takeScreenshots().catch(console.error);