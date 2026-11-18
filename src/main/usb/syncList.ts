import * as fs from 'fs';

/**
 * `PIONEER/rekordbox/playlists3.sync`: the playlists rekordbox's automatic sync
 * keeps on a stick. Plain XML, CRLF, written by rekordbox:
 *
 *   <Sync DBID="…" AutomaticSync="1" AllPlaylists="0" …>
 *     <Playlists>
 *       <NODE Id="199D185A" ParentId="0" Attribute="0" Lib_Type="0" …/>
 *
 * `Id` is the hex of the library's `djmdPlaylist.ID`, which is decimal; `Id="0"`
 * is the root. An id the library no longer has is a deleted playlist.
 * `AllPlaylists="1"` means every playlist is synced. The file is absent on a
 * stick made with Export rather than Sync.
 */

export interface SyncNode {
  /** The library's playlist id, decimal, as `djmdPlaylist.ID` holds it. */
  id: string;
  parentId: string;
  /** 0 a playlist, 1 a folder, as in `djmdPlaylist.Attribute`. */
  attribute: number;
}

export interface SyncList {
  allPlaylists: boolean;
  automaticSync: boolean;
  /** Every listed node except the root. */
  nodes: SyncNode[];
}

const attributesOf = (tag: string): Map<string, string> =>
  new Map([...tag.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]));

/** Hex to the decimal string the library uses; ids are up to 64 bits, past a double's precision. */
function hexToDecimal(hex: string | undefined): string | null {
  if (!hex || !/^[0-9a-f]{1,16}$/i.test(hex)) {return null;}
  return BigInt(`0x${hex}`).toString();
}

export function parseSyncList(xml: string): SyncList {
  const sync = /<Sync\b[^>]*>/.exec(xml);
  if (!sync) {throw new Error('Not a rekordbox sync list: no <Sync> element');}
  const head = attributesOf(sync[0]);
  const nodes: SyncNode[] = [];
  for (const m of xml.matchAll(/<NODE\b[^>]*>/g)) {
    const attrs = attributesOf(m[0]);
    const id = hexToDecimal(attrs.get('Id'));
    if (id === null || id === '0') {continue;}
    nodes.push({
      id,
      parentId: hexToDecimal(attrs.get('ParentId')) ?? '0',
      attribute: Number(attrs.get('Attribute') ?? 0),
    });
  }
  return {
    allPlaylists: head.get('AllPlaylists') === '1',
    automaticSync: head.get('AutomaticSync') === '1',
    nodes,
  };
}

/** The sync list at `file`, or null when the stick has none. */
export async function readSyncList(file: string): Promise<SyncList | null> {
  let xml: string;
  try {
    xml = await fs.promises.readFile(file, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {return null;}
    throw e;
  }
  return parseSyncList(xml);
}
