import json, os, shutil, sys, tempfile, time, warnings
warnings.filterwarnings("ignore")
import logging; logging.disable(logging.WARNING)
from pyrekordbox.masterdb import MasterDatabase

db = None


def check(p):
    """Copy master.db aside and read it, the way the app reads: never the live file."""
    path = next((c for c in p["candidates"] if os.path.isfile(c)), None)
    if path is None:
        return {"found": False, "looked": p["candidates"]}
    tmp = tempfile.mkdtemp(prefix="rblf-check-")
    try:
        t0 = time.perf_counter()
        for suffix in ("", "-wal", "-shm"):
            if os.path.isfile(path + suffix):
                shutil.copy2(path + suffix, os.path.join(tmp, "master.db" + suffix))
        t1 = time.perf_counter()
        d = MasterDatabase(path=os.path.join(tmp, "master.db"), key=p["key"], unlock=True)
        t2 = time.perf_counter()
        counts = {
            "tracks": d.get_content().count(),
            "cues": d.get_cue().count(),
            "playlists": d.get_playlist().count(),
            "playlistEntries": d.get_playlist_songs().count(),
        }
        tracks = d.get_content().all()
        t3 = time.perf_counter()
        d.close()
        return {"found": True, "path": path, "sizeMB": round(os.path.getsize(path) / 1048576, 1), **counts,
                "loadedTracks": len(tracks), "copyMs": round((t1 - t0) * 1000), "openMs": round((t2 - t1) * 1000),
                "readMs": round((t3 - t2) * 1000)}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def call(method, p):
    global db
    if method == "check":
        return check(p)
    if method == "open":
        db = MasterDatabase(path=p["path"], key=p["key"], unlock=True)
        return {"usn": db.get_local_usn()}
    if method == "counts":
        return {"content": db.get_content().count(), "playlists": db.get_playlist().count()}
    if method == "version":
        import pyrekordbox
        return {"python": sys.version.split()[0], "pyrekordbox": pyrekordbox.__version__}
    if method == "close":
        db.close(); return {}
    raise ValueError(f"unknown method {method}")


for line in sys.stdin:
    req = json.loads(line)
    try:
        out = {"id": req["id"], "result": call(req["method"], req.get("params", {}))}
    except Exception as e:
        out = {"id": req["id"], "error": f"{type(e).__name__}: {e}"}
    sys.stdout.write(json.dumps(out) + "\n"); sys.stdout.flush()
