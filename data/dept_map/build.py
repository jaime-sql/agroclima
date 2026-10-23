"""One-command build: python3 build.py  (needs shapely). Pinned sources below."""
import json, hashlib, urllib.request, unicodedata
from shapely.geometry import shape, Point
GB = "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/SLV/ADM1/geoBoundaries-SLV-ADM1_simplified.geojson"
LOC = "https://raw.githubusercontent.com/jaime-sql/agroclima/main/src/data/locations.json"
def get(u):
    return urllib.request.urlopen(u, timeout=60).read()
def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return s.replace("departamento de ", "").strip()
gb_raw, loc_raw = get(GB), get(LOC)
open("departments.geojson", "wb").write(gb_raw)
gb, locs = json.loads(gb_raw), json.loads(loc_raw)
depts = {f["properties"]["shapeName"]: shape(f["geometry"]) for f in gb["features"]}
out, issues = {d: [] for d in depts}, []
for r in locs:
    hit = [d for d, g in depts.items() if g.contains(Point(r["lon"], r["lat"]))]
    if not hit:
        issues.append(f"{r['id']}: outside all departments")
        continue
    if norm(hit[0]) != norm(r["department"]):
        issues.append(f"{r['id']}: listed {r['department']}, polygon {hit[0]}")
    out[hit[0]].append(r["id"])
table = [{"department": d, "n_points": len(v), "location_ids": v,
          "has_data": bool(v)} for d, v in sorted(out.items())]
json.dump({"sources": {"boundaries": GB, "locations": LOC,
           "boundaries_sha256": hashlib.sha256(gb_raw).hexdigest(),
           "locations_sha256": hashlib.sha256(loc_raw).hexdigest()},
           "departments": table, "issues": issues},
          open("department_points.json", "w"), ensure_ascii=False, indent=1)
print(len(depts), "departments;", sum(t["has_data"] for t in table), "with points")
for t in table: print(f"{t['department']}: {t['n_points']}")
print("issues:", issues or "none")
