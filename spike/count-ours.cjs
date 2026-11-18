const Database = require('better-sqlite3-multiple-ciphers');
const key = require(process.argv[3]).key;
const db = new Database(process.argv[2], { readonly: true });
db.pragma("cipher='sqlcipher'"); db.pragma('legacy=4'); db.pragma(`key='${key}'`);
const q = (s) => db.prepare(s).get().n;
console.log(JSON.stringify({
  content_all: q('select count(*) n from djmdContent'),
  content_live: q('select count(*) n from djmdContent where rb_local_deleted=0'),
  cues_all: q('select count(*) n from djmdCue'),
  cues_live: q('select count(*) n from djmdCue where rb_local_deleted=0'),
  loops: q('select count(*) n from djmdCue where OutMsec>0'),
  playlists_all: q('select count(*) n from djmdPlaylist'),
  songs_all: q('select count(*) n from djmdSongPlaylist'),
}));
