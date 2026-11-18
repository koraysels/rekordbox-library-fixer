import json, sys, warnings
warnings.filterwarnings("ignore")
from pyrekordbox.masterdb import MasterDatabase
key = json.load(open(sys.argv[2]))["key"]
db = MasterDatabase(path=sys.argv[1], key=key, unlock=True)
usn0 = db.get_local_usn()
t = db.get_content().order_by("ID").first()
before = (t.ID, t.rb_local_usn)
t.FolderPath = "/spike/moved/" + (t.FileNameL or "x")
db.commit()
db.close()
db = MasterDatabase(path=sys.argv[1], key=key, unlock=True)
t2 = db.get_content(ID=before[0])
print(json.dumps({"id": before[0], "usn_track_before": before[1], "usn_track_after": t2.rb_local_usn,
                  "usn_db_before": usn0, "usn_db_after": db.get_local_usn(),
                  "path_ok": t2.FolderPath.startswith("/spike/moved/")}))
