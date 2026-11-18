import json, sys, warnings
warnings.filterwarnings("ignore")
import logging; logging.disable(logging.WARNING)
from pyrekordbox.masterdb import MasterDatabase

db = None
def call(method, p):
    global db
    if method == "open":
        db = MasterDatabase(path=p["path"], key=p["key"], unlock=True)
        return {"usn": db.get_local_usn()}
    if method == "counts":
        return {"content": db.get_content().count(), "playlists": db.get_playlist().count()}
    if method == "close":
        db.close(); return {}
    raise ValueError(f"unknown method {method}")

for line in sys.stdin:
    req = json.loads(line)
    try:
        out = {"id": req["id"], "result": call(req["method"], req.get("params", {}))}
    except Exception as e:
        out = {"id": req["id"], "error": str(e)}
    sys.stdout.write(json.dumps(out) + "\n"); sys.stdout.flush()
