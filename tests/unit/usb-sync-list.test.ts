import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.unmock('fs');

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseSyncList, readSyncList } from '../../src/main/usb/syncList';

const xml = (allPlaylists: string, nodes: string) => [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '',
  `<Sync DBID="123" AutomaticSync="1" AllPlaylists="${allPlaylists}" IncludeCue="1" ForcedSync="0" Timestamp="0">`,
  '  <Playlists>',
  '    <NODE Id="0" ParentId="0" Attribute="1" Lib_Type="0" Dev_ID="0" Timestamp="0" CheckType="1"/>',
  nodes,
  '  </Playlists>',
  '</Sync>',
].join('\r\n');

describe('parseSyncList', () => {
  it('turns hex ids into the library\'s decimal ids and leaves out the root', () => {
    const list = parseSyncList(xml('0', [
      '    <NODE Id="1A2B3C4D" ParentId="0" Attribute="0" Lib_Type="0"/>',
      '    <NODE Id="2A" ParentId="1A2B3C4D" Attribute="1" Lib_Type="0"/>',
    ].join('\r\n')));
    expect(list).toEqual({
      allPlaylists: false,
      automaticSync: true,
      nodes: [
        { id: '439041101', parentId: '0', attribute: 0 },
        { id: '42', parentId: '439041101', attribute: 1 },
      ],
    });
  });

  it('keeps a 64-bit id exact', () => {
    const list = parseSyncList(xml('0', '    <NODE Id="FEDCBA9876543210" ParentId="0" Attribute="0" Lib_Type="1"/>'));
    expect(list.nodes[0].id).toBe('18364758544493064720');
  });

  it('reads AllPlaylists', () => {
    expect(parseSyncList(xml('1', '')).allPlaylists).toBe(true);
  });

  it('skips a node whose id is not hex', () => {
    expect(parseSyncList(xml('0', '    <NODE Id="nope" ParentId="0" Attribute="0"/>')).nodes).toEqual([]);
  });

  it('refuses a file that is not a sync list', () => {
    expect(() => parseSyncList('<DJ_PLAYLISTS/>')).toThrow(/sync list/);
  });
});

describe('readSyncList', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synclist-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('is null when the stick has no sync list (made with Export)', async () => {
    expect(await readSyncList(path.join(dir, 'playlists3.sync'))).toBeNull();
  });

  it('reads the file when it is there', async () => {
    const file = path.join(dir, 'playlists3.sync');
    fs.writeFileSync(file, xml('0', '    <NODE Id="A" ParentId="0" Attribute="0"/>'));
    expect((await readSyncList(file))?.nodes).toEqual([{ id: '10', parentId: '0', attribute: 0 }]);
  });
});
