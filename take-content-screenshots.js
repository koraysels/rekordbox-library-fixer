const { _electron: electron } = require('playwright');
const path = require('path');

async function takeScreenshots() {
  console.log('Launching Electron app...');
  const app = await electron.launch({
    args: ['dist/main/main.js'],
    cwd: process.cwd()
  });

  const page = await app.firstWindow();
  
  // Wait for app to be ready
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('img[alt="Rekordbox Library Manager"]', { timeout: 10000 });
  await page.waitForTimeout(2000);
  
  console.log('Taking initial screenshot...');
  await page.screenshot({ 
    path: 'screenshots/main-interface.png', 
    fullPage: false 
  });
  
  // Load the large library
  console.log('Loading large library...');
  await page.click('button:has-text("Select Library")');
  await page.waitForTimeout(1000);
  
  // We need to mock the file dialog since we can't interact with system dialogs
  // Instead, let's use the Electron API directly
  await page.evaluate(async () => {
    const libraryPath = './tests/fixtures/rekordbox-large-library.xml';
    try {
      console.log('Parsing library:', libraryPath);
      const library = await window.electronAPI.parseRekordboxLibrary(libraryPath);
      console.log('Library parsed, tracks:', library.tracks.length);
      
      // Trigger a custom event to update the UI
      window.dispatchEvent(new CustomEvent('library-loaded', { 
        detail: { library, path: libraryPath } 
      }));
    } catch (error) {
      console.error('Failed to load library:', error);
    }
  });
  
  // Wait for library to load and UI to update
  await page.waitForTimeout(3000);
  
  console.log('Taking loaded library screenshot...');
  await page.screenshot({ 
    path: 'screenshots/library-loaded.png', 
    fullPage: false 
  });
  
  // Click on Duplicate Detection tab
  console.log('Navigating to duplicate detection...');
  await page.click('[data-tab="duplicates"]');
  await page.waitForTimeout(1000);
  
  console.log('Taking duplicate detection screenshot...');
  await page.screenshot({ 
    path: 'screenshots/duplicate-detection.png', 
    fullPage: false 
  });
  
  // Try to load library with duplicates for better demo
  await page.evaluate(async () => {
    const libraryPath = './tests/fixtures/library-with-duplicates.xml';
    try {
      console.log('Parsing duplicates library:', libraryPath);
      const library = await window.electronAPI.parseRekordboxLibrary(libraryPath);
      console.log('Duplicates library parsed, tracks:', library.tracks.length);
      
      // Trigger a custom event to update the UI
      window.dispatchEvent(new CustomEvent('library-loaded', { 
        detail: { library, path: libraryPath } 
      }));
    } catch (error) {
      console.error('Failed to load duplicates library:', error);
    }
  });
  
  await page.waitForTimeout(2000);
  
  // Try to trigger duplicate scan
  const scanButton = page.locator('button:has-text("Scan for Duplicates")');
  const scanExists = await scanButton.count() > 0;
  
  if (scanExists) {
    console.log('Triggering duplicate scan...');
    await scanButton.click();
    await page.waitForTimeout(3000);
    
    console.log('Taking duplicate results screenshot...');
    await page.screenshot({ 
      path: 'screenshots/duplicate-results.png', 
      fullPage: false 
    });
  }
  
  // Check Track Relocation tab
  console.log('Navigating to track relocation...');
  const relocateTab = page.locator('[data-tab="relocate"]');
  const relocateExists = await relocateTab.count() > 0;
  
  if (relocateExists) {
    await relocateTab.click();
    await page.waitForTimeout(1000);
    
    console.log('Taking track relocation screenshot...');
    await page.screenshot({ 
      path: 'screenshots/track-relocation.png', 
      fullPage: false 
    });
  }
  
  // Check Settings
  console.log('Opening settings...');
  const settingsButton = page.locator('button:has-text("Settings")');
  const settingsExists = await settingsButton.count() > 0;
  
  if (settingsExists) {
    await settingsButton.click();
    await page.waitForTimeout(1000);
    
    console.log('Taking settings screenshot...');
    await page.screenshot({ 
      path: 'screenshots/settings-panel.png', 
      fullPage: false 
    });
  }
  
  console.log('Screenshots completed!');
  await app.close();
}

takeScreenshots().catch(console.error);