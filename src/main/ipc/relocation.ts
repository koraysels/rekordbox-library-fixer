import * as fs from 'fs';
import { ipcMain } from 'electron';
import { runtime, safeConsole, sendToWindow } from '../runtime';
import { mainLogger as appLogger } from '../appLogger';
import { assertWritableLibraryPath, isRekordboxDatabasePath } from '../librarySource';
import { isRekordboxRunning } from '../rekordboxRunning';
import { relocateTracksInDb } from '../rekordboxDbRelocator';
import type { TrackPayload, RelocationPayload, RelocationResultPayload } from '../ipcContract';
import type { RelocationOptions, MissingTrack } from '../trackRelocator';

// Store active operations for cancellation
const activeOperations = new Map<string, { cancelled: boolean }>();

/**
 * Write found files back into whichever library is open.
 *
 * A database-backed collection never reads an XML export, so relocating used to
 * change nothing at all for it: the tracks stayed missing however many files the
 * search found. Such a library is now edited directly, under the same two
 * refusals as merging duplicates — rekordbox closed, and a backup taken first.
 */
async function applyRelocationsToLibrary(
  libraryPath: string,
  dbKey: string | undefined,
  relocations: Array<{ trackId: string; newLocation?: string; oldLocation?: string }>
): Promise<{ tracksUpdated: number; backupPath: string; skipped: Array<{ trackId: string; reason: string }> }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${libraryPath}.backup.${timestamp}`;

  if (isRekordboxDatabasePath(libraryPath)) {
    if (!dbKey) {
      throw new Error('The rekordbox database needs its key before it can be changed — paste it on the Library screen.');
    }
    const outcome = relocateTracksInDb(
      libraryPath,
      dbKey,
      relocations
        .filter((r) => r.newLocation)
        .map((r) => ({ trackId: r.trackId, newLocation: r.newLocation as string })),
      { backupPath }
    );
    safeConsole.log(`✅ Database updated with ${outcome.tracksRelocated} relocated tracks`);
    return { tracksUpdated: outcome.tracksRelocated, backupPath, skipped: outcome.skipped };
  }

  assertWritableLibraryPath(libraryPath);
  fs.copyFileSync(libraryPath, backupPath);
  safeConsole.log(`💾 Backup created: ${backupPath}`);

  const library = await runtime().rekordboxParser.parseLibrary(libraryPath);
  const skipped: Array<{ trackId: string; reason: string }> = [];
  let tracksUpdated = 0;
  for (const relocation of relocations) {
    const track = library.tracks.get(relocation.trackId);
    if (track && relocation.newLocation) {
      track.location = relocation.newLocation;
      library.tracks.set(relocation.trackId, track);
      tracksUpdated++;
    } else {
      skipped.push({ trackId: relocation.trackId, reason: track ? 'no new location' : 'not in the library' });
    }
  }
  if (tracksUpdated > 0) {
    await runtime().rekordboxParser.saveLibrary(library, libraryPath);
    safeConsole.log(`✅ XML updated with ${tracksUpdated} track location changes`);
    runtime().logger.logLibrarySaving(libraryPath, library.tracks.size);
  }
  return { tracksUpdated, backupPath, skipped };
}

/**
 * Finding missing tracks again and writing the new paths back into
 * whichever library is open.
 */
export function registerRelocationIpc(): void {
  ipcMain.handle('reset-track-locations', async (_, trackIds: string[]) => {
    safeConsole.log(`🔄 IPC: Resetting locations for ${trackIds.length} tracks`);
    try {
      // This essentially marks tracks as "relocatable" by clearing their resolved status
      // The actual library update will happen when the user applies relocations
      safeConsole.log(`✅ Track locations reset for ${trackIds.length} tracks`);
      return { success: true, data: { resetTracks: trackIds.length } };
    } catch (error) {
      safeConsole.error('❌ Reset track locations failed:', error);
      runtime().logger.error('RESET_TRACK_LOCATIONS_FAILED', {
        trackCount: trackIds.length,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  ipcMain.handle('auto-relocate-tracks', async (_event, data: {
    tracks: MissingTrack[];
    options: RelocationOptions;
    libraryPath: string;
    dbKey?: string;
  }) => {
    appLogger.info(`🤖 IPC: Auto-relocating ${data.tracks.length} tracks using manual logic`);

    const operationId = Date.now().toString();
    const cancelToken = { cancelled: false };
    activeOperations.set(operationId, cancelToken);

    try {
      // A database-backed library is written through the database writer; an XML
      // one through the XML writer. Fail before the search rather than after it
      // when the database cannot be written at all.
      if (isRekordboxDatabasePath(data.libraryPath)) {
        if (!data.dbKey) {
          throw new Error('The rekordbox database needs its key before it can be changed — paste it on the Library screen.');
        }
        if (isRekordboxRunning()) {
          throw new Error('Close rekordbox first — it keeps the database open, and writing while it runs risks losing the change.');
        }
      } else {
        assertWritableLibraryPath(data.libraryPath);
      }

      let successCount = 0;
      const results: RelocationResultPayload[] = [];
      const successfulRelocations: Array<{
        trackId: string;
        oldLocation: string;
        newLocation: string;
      }> = [];

      // Send initial progress
      sendToWindow('auto-relocate-progress', {
        operationId,
        type: 'start',
        total: data.tracks.length,
        current: 0,
        message: 'Starting auto-relocation...'
      });

      // Build the filesystem index ONCE up front so 5000 tracks reuse it
      // instead of re-globbing the whole tree per track (was the crash cause).
      await runtime().trackRelocator.beginRelocationRun(data.options);

      // Process tracks sequentially using the SAME logic as manual relocation
      for (let i = 0; i < data.tracks.length; i++) {
        // Check if cancelled
        if (cancelToken.cancelled) {
          appLogger.info('⚠️ Auto-relocation cancelled by user');
          sendToWindow('auto-relocate-progress', {
            operationId,
            type: 'cancelled',
            total: data.tracks.length,
            current: i,
            message: 'Auto-relocation cancelled'
          });
          break;
        }

        const track = data.tracks[i];

        // Send progress update for searching
        sendToWindow('auto-relocate-progress', {
          operationId,
          type: 'searching',
          total: data.tracks.length,
          current: i + 1,
          trackName: track.name,
          trackArtist: track.artist,
          message: `Searching for: ${track.name}`
        });

        try {
          // Use the EXACT same logic as manual relocation
          appLogger.info(`🔍 Auto-relocating track ${i+1}/${data.tracks.length}: "${track.name}" by ${track.artist}`);
          const candidatesResult = await runtime().trackRelocator.findRelocationCandidates(track, data.options);

          if (candidatesResult.length > 0) {
            // Use the best candidate (highest confidence) - same as manual
            const bestCandidate = candidatesResult.reduce((best, current) =>
              current.confidence > best.confidence ? current : best
            );

            appLogger.info(`   Found ${candidatesResult.length} candidates, best: ${bestCandidate.path} (confidence: ${bestCandidate.confidence})`);

            // Only auto-relocate if confidence is high enough
            if (bestCandidate.confidence >= data.options.matchThreshold) {
              successfulRelocations.push({
                trackId: track.id,
                oldLocation: track.originalLocation,
                newLocation: bestCandidate.path
              });

              results.push({
                trackId: track.id,
                trackName: track.name,
                success: true,
                newLocation: bestCandidate.path,
                confidence: bestCandidate.confidence,
                oldLocation: track.originalLocation
              });

              successCount++;

              // Send success update
              sendToWindow('auto-relocate-progress', {
                operationId,
                type: 'found',
                total: data.tracks.length,
                current: i + 1,
                trackName: track.name,
                confidence: bestCandidate.confidence,
                newLocation: bestCandidate.path,
                message: `Found: ${track.name} (${Math.round(bestCandidate.confidence * 100)}%)`,
                successCount
              });

              appLogger.info(`   ✅ Auto-relocating: confidence ${bestCandidate.confidence} >= threshold ${data.options.matchThreshold}`);
            } else {
              results.push({
                trackId: track.id,
                trackName: track.name,
                success: false,
                error: 'No high-confidence candidate found',
                oldLocation: track.originalLocation,
                newLocation: '',
                confidence: bestCandidate.confidence
              });

              // Send low confidence update
              sendToWindow('auto-relocate-progress', {
                operationId,
                type: 'low-confidence',
                total: data.tracks.length,
                current: i + 1,
                trackName: track.name,
                confidence: bestCandidate.confidence,
                message: `Low confidence: ${track.name}`,
                successCount
              });

              appLogger.info(`   ❌ Confidence too low: ${bestCandidate.confidence} < ${data.options.matchThreshold}`);
            }
          } else {
            results.push({
              trackId: track.id,
              trackName: track.name,
              success: false,
              oldLocation: track.originalLocation,
              newLocation: '',
              error: 'No candidates found'
            });

            // Send not found update
            sendToWindow('auto-relocate-progress', {
              operationId,
              type: 'not-found',
              total: data.tracks.length,
              current: i + 1,
              trackName: track.name,
              message: `Not found: ${track.name}`,
              successCount
            });

            appLogger.info(`   ❌ No candidates found for "${track.name}"`);
          }
        } catch (error) {
          results.push({
            trackId: track.id,
            trackName: track.name,
            success: false,
            oldLocation: track.originalLocation,
            newLocation: '',
            error: error instanceof Error ? error.message : 'Processing error'
          });
          appLogger.error(`   ❌ Error processing track "${track.name}":`, error);
        }
      }

      // Step 2: Apply the relocations using batch relocation logic
      let batchResult: {
        success: boolean;
        data?: RelocationResultPayload[];
        xmlUpdated?: boolean;
        libraryUpdated?: boolean;
        tracksUpdated?: number;
        backupPath?: string;
        error?: string;
      } | null = null;

      // Do NOT commit partial work to the XML if the user cancelled mid-run
      if (!cancelToken.cancelled && successfulRelocations.length > 0 && data.libraryPath) {
        safeConsole.log(`📝 Applying ${successfulRelocations.length} auto-relocations using batch process`);

        try {
          // Step 2a: Verify relocations first (without XML update)
          const verificationResults = await runtime().trackRelocator.batchRelocate(successfulRelocations);
          const verifiedSuccessful = verificationResults.filter(r => r.success);

          if (verifiedSuccessful.length === 0) {
            safeConsole.log('⚠️ No successful relocations to apply to XML');
            batchResult = { success: true, data: verificationResults, xmlUpdated: false, tracksUpdated: 0 };
          } else {
            // Step 2b: Write the found files into whichever library is open.
            const { tracksUpdated, backupPath, skipped } =
              await applyRelocationsToLibrary(data.libraryPath, data.dbKey, verifiedSuccessful);
            for (const skip of skipped) {
              safeConsole.warn(`⚠️ Track ${skip.trackId} not relocated: ${skip.reason}`);
            }

            batchResult = {
              success: true,
              data: verificationResults,
              backupPath,
              xmlUpdated: tracksUpdated > 0,
              libraryUpdated: tracksUpdated > 0,
              tracksUpdated
            };
          }
        } catch (error) {
          safeConsole.error('❌ Auto-relocate batch processing failed:', error);
          batchResult = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
          };
        }
      }

      // Send XML update notification if needed
      if (successfulRelocations.length > 0 && data.libraryPath) {
        sendToWindow('auto-relocate-progress', {
          operationId,
          type: 'updating-xml',
          total: data.tracks.length,
          current: data.tracks.length,
          message: `Updating XML with ${successfulRelocations.length} relocations...`
        });
      }

      // Clean up cancel token and free the cached file index
      activeOperations.delete(operationId);
      runtime().trackRelocator.endRelocationRun();

      // Send completion
      sendToWindow('auto-relocate-progress', {
        operationId,
        type: 'complete',
        total: data.tracks.length,
        current: data.tracks.length,
        successCount,
        message: `Complete: ${successCount}/${data.tracks.length} tracks relocated`
      });

      appLogger.info(`✅ Auto-relocation complete: ${successCount}/${data.tracks.length} successful (using manual logic)`);

      return {
        success: true,
        operationId,
        data: {
          totalTracks: data.tracks.length,
          successfulRelocations: successCount,
          results,
          xmlUpdated: batchResult?.xmlUpdated || false,
          tracksUpdated: batchResult?.tracksUpdated || 0,
          backupPath: batchResult?.backupPath
        }
      };
    } catch (error) {
      // Clean up active operation and free the cached file index
      activeOperations.delete(operationId);
      runtime().trackRelocator.endRelocationRun();

      appLogger.error('❌ Auto-relocate tracks failed:', error);
      runtime().logger.error('AUTO_RELOCATE_TRACKS_FAILED', {
        trackCount: data.tracks.length,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });

      // Send error notification
      sendToWindow('auto-relocate-progress', {
        operationId,
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  ipcMain.handle('cancel-auto-relocate', async (_, operationId: string) => {
    const cancelToken = activeOperations.get(operationId);
    if (cancelToken) {
      cancelToken.cancelled = true;
      activeOperations.delete(operationId);

      appLogger.info(`⚠️ Auto-relocation ${operationId} cancelled by user`);

      sendToWindow('auto-relocate-progress', {
        operationId,
        type: 'cancelled',
        message: 'Auto-relocation cancelled'
      });

      return { success: true };
    }
    return { success: false, error: 'Operation not found' };
  });

  ipcMain.handle('find-missing-tracks', async (_, tracks: Record<string, TrackPayload>) => {
    appLogger.info('🔍 IPC: Finding missing tracks');
    try {
      const tracksMap = new Map(Object.entries(tracks));
      const missingTracks = await runtime().trackRelocator.findMissingTracks(tracksMap);
      appLogger.info(`✅ Found ${missingTracks.length} missing tracks`);
      return { success: true, data: missingTracks };
    } catch (error) {
      appLogger.error('❌ Find missing tracks failed:', error);
      runtime().logger.error('FIND_MISSING_TRACKS_FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  ipcMain.handle('find-relocation-candidates', async (_, track: MissingTrack, options: RelocationOptions) => {
    safeConsole.log(`🔍 IPC: Finding relocation candidates for track ${track.id}`);
    try {
      const candidates = await runtime().trackRelocator.findRelocationCandidates(track, options);
      safeConsole.log(`✅ Found ${candidates.length} relocation candidates`);
      return { success: true, data: candidates };
    } catch (error) {
      safeConsole.error('❌ Find relocation candidates failed:', error);
      runtime().logger.error('FIND_RELOCATION_CANDIDATES_FAILED', {
        trackId: track.id,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  ipcMain.handle('relocate-track', async (_, trackId: string, oldLocation: string, newLocation: string) => {
    safeConsole.log(`📁 IPC: Relocating track ${trackId}`);
    try {
      const result = await runtime().trackRelocator.relocateTrack(trackId, oldLocation, newLocation);
      if (result.success) {
        safeConsole.log('✅ Track relocation successful');
      } else {
        safeConsole.log(`❌ Track relocation failed: ${result.error}`);
      }
      return { success: true, data: result };
    } catch (error) {
      safeConsole.error('❌ Relocate track failed:', error);
      runtime().logger.error('RELOCATE_TRACK_FAILED', {
        trackId,
        oldLocation,
        newLocation,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  ipcMain.handle('batch-relocate-tracks', async (_, data: {
    libraryPath: string;
    relocations: RelocationPayload[];
    dbKey?: string;
  }) => {
    safeConsole.log(`📁 IPC: Batch relocating ${data.relocations.length} tracks`);
    try {
      // Step 1: Verify relocations first (without XML update)
      const verificationResults = await runtime().trackRelocator.batchRelocate(data.relocations);
      const successfulRelocations = verificationResults.filter(r => r.success);

      if (successfulRelocations.length === 0) {
        safeConsole.log('⚠️ No successful relocations to apply to XML');
        return { success: true, data: verificationResults };
      }

      // Step 2: Write the new locations into whichever library is open — the
      // XML, or rekordbox's database when that is what was loaded.
      const { tracksUpdated, backupPath, skipped } =
        await applyRelocationsToLibrary(data.libraryPath, data.dbKey, successfulRelocations);
      for (const skip of skipped) {
        safeConsole.warn(`⚠️ Track ${skip.trackId} not relocated: ${skip.reason}`);
      }

      const successCount = verificationResults.filter(r => r.success).length;
      safeConsole.log(`✅ Batch relocation complete: ${successCount}/${data.relocations.length} successful, library updated with ${tracksUpdated} changes`);

      return {
        success: true,
        data: verificationResults,
        backupPath,
        xmlUpdated: tracksUpdated > 0,
        libraryUpdated: tracksUpdated > 0,
        tracksUpdated
      };
    } catch (error) {
      safeConsole.error('❌ Batch relocate tracks failed:', error);
      runtime().logger.error('BATCH_RELOCATE_TRACKS_FAILED', {
        count: data.relocations.length,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });
  }
