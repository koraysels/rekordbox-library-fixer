import json, sys, time
t0 = time.perf_counter()
from pyrekordbox import Rekordbox6Database
t1 = time.perf_counter()
key = json.load(open(sys.argv[2]))["key"]
db = Rekordbox6Database(path=sys.argv[1], key=key, unlock=True)
t2 = time.perf_counter()
tracks = db.get_content().all()
cues = db.get_cue().all()
pls = db.get_playlist().all()
songs = db.get_playlist_songs().all()
t3 = time.perf_counter()
paths = sum(1 for t in tracks if t.FolderPath)
loops = sum(1 for c in cues if (c.OutMsec or -1) > 0)
print(json.dumps({
  "content": len(tracks), "with_path": paths, "cues": len(cues), "loops": loops,
  "playlists": len(pls), "playlist_songs": len(songs),
  "usn": db.get_local_usn(),
  "import_s": round(t1-t0,2), "open_s": round(t2-t1,2), "read_s": round(t3-t2,2)}))
db.close()
