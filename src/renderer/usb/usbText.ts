import type { NotOnStickReason, PlaylistCheck, UsbCheckResult, UsbStick } from '../../main/ipcContract';
import { isIncomplete } from './usbReport';

/** What the USB Sticks page says, in one place so the wording is tested and stays consistent. */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The summary's first line: "19 playlists incomplete on KROCKSTICK". */
export function headline(result: UsbCheckResult, stickName: string): string {
  const short = result.playlists.filter(isIncomplete).length;
  if (result.playlists.length === 0) {return `No synced playlists to check on ${stickName}`;}
  if (short === 0) {return `Every synced playlist is complete on ${stickName}`;}
  return `${plural(short, 'playlist')} incomplete on ${stickName}`;
}

/** The line under it: how many were checked and how many came out empty. */
export function subline(result: UsbCheckResult): string {
  const parts = [`${plural(result.playlists.length, 'playlist')} checked`];
  if (result.totals.emptyOnStick > 0) {
    parts.push(`${result.totals.emptyOnStick} empty on the stick`);
  }
  if (result.missingOnStick.length > 0) {
    parts.push(`${result.missingOnStick.length} not on the stick at all`);
  }
  return parts.join(' · ');
}

/** "Plug in ICYFAST BLA: 634 tracks" — the top action when a drive was not there for the sync. */
export const plugInLine = (d: { drive: string; tracks: number }) =>
  `Plug in ${d.drive}: ${plural(d.tracks, 'track')}`;

export const plugInDetail = (d: { entries: number }) =>
  `${plural(d.entries, 'playlist entry', 'playlist entries')} live on it. Plug it in, then sync again in rekordbox.`;

/** A reason as a short label, for counts and per-track tags. */
export function reasonLabel(reason: NotOnStickReason): string {
  switch (reason) {
    case 'drive-unplugged': return 'Drive not plugged in';
    case 'missing': return 'File is gone';
    case 'no-access': return 'No access to the file';
    case 'streaming': return 'Streaming track';
    case 'not-synced-yet': return 'Not synced yet';
  }
}

/** What to do about a reason. `drive-unplugged` names its drive in `plugInLine` instead. */
export function reasonFix(reason: NotOnStickReason): string {
  switch (reason) {
    case 'drive-unplugged': return 'Plug the drive in, then sync again in rekordbox.';
    case 'missing': return 'The file is not where the library says. Find it with Track Relocation, then sync again in rekordbox.';
    case 'no-access': return "The app isn't allowed to look at these files. Give it access (on a Mac: System Settings › Privacy & Security › Files and Folders), then check again.";
    case 'streaming': return 'Streaming tracks are never copied to a stick: a player without an internet connection cannot play them.';
    case 'not-synced-yet': return 'The file is there and readable: sync again in rekordbox and it is copied.';
  }
}

/** A reason with its count: "206 entries: File is gone". */
export const reasonCountLine = (reason: NotOnStickReason, count: number) =>
  `${reasonLabel(reason)}: ${plural(count, 'entry', 'entries')}`;

/** One playlist's counts: "27 of 87 on the stick". */
export function playlistCounts(p: PlaylistCheck): string {
  if (!p.onStick) {return `Not on the stick · ${plural(p.libraryCount, 'track')} in the library`;}
  return `${p.stickCount} of ${p.libraryCount} on the stick`;
}

/** Entries on the stick no library entry accounts for: taken out of the playlist since the last sync. */
export const extraLine = (n: number) =>
  `${plural(n, 'track')} on the stick ${n === 1 ? 'is' : 'are'} no longer in this playlist in the library.`;

/** The notes under the summary: what the check did not look at, and how it chose the playlists. */
export function stickNotes(stick: UsbStick, result: UsbCheckResult): string[] {
  const notes: string[] = [];
  if (!result.syncList.present) {
    notes.push('This stick was made with Export, not Sync: the playlists checked are the library playlists it carries by name.');
  } else if (result.syncList.allPlaylists) {
    notes.push('rekordbox syncs every playlist to this stick.');
  }
  if (stick.hasOneLibrary) {
    notes.push('Only the Device Library (CDJ-2000, CDJ-2000NXS, XDJ-RX2 and the like) is checked; this stick also has a OneLibrary database, which is not.');
  }
  return notes;
}

export const DATABASE_NEEDED =
  'The USB check compares the stick with the rekordbox database, so it needs the database open, not an XML export.';

export const NO_STICK =
  'No rekordbox USB stick found. Plug in a stick rekordbox has synced or exported to, then rescan.';

export const READ_ONLY_NOTE = 'Nothing is written: the stick and the library are only read.';
