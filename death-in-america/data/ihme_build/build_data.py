import csv, glob, json, os, sys, collections, statistics
S = sys.argv[1]; REPO = sys.argv[2]
RAW = os.path.join(S, "raw")
topo = json.load(open(os.path.join(S, "npm/node_modules/us-atlas/counties-10m.json")))
geo_ids = {g["id"]: g["properties"]["name"] for g in topo["objects"]["counties"]["geometries"]}
STATE = {}
for g in topo["objects"]["states"]["geometries"]: STATE[g["id"]] = g["properties"]["name"]

import re
def clean(n):
    return re.sub(r"\s*\([^)]*\)$", "", n)

def rnd(x):
    if x is None: return None
    return round(x, 2) if x < 10 else round(x, 1)

def build(rows, out_dir, groups, label):
    os.makedirs(out_dir, exist_ok=True)
    years = sorted({int(r["year"]) for r in rows})
    causes = {}
    county = collections.defaultdict(dict)   # cause -> {(fips,year): (v,lo,hi)}
    names = {}; locs = {}
    nat = collections.defaultdict(dict); st = collections.defaultdict(lambda: collections.defaultdict(dict))
    for r in rows:
        cid = int(r["cause_id"]); causes[cid] = r["cause_name"]
        f = r["fips"].strip()
        v = float(r["rate"]) if r["rate"] else None
        lo = float(r["lower"]) if r["lower"] else None
        hi = float(r["upper"]) if r["upper"] else None
        y = int(r["year"])
        if f in ("", "0"):
            nat[cid][y] = (v, lo, hi)
        elif int(f) < 100:
            st["%02d" % int(f)][cid][y] = (v, lo, hi)
        else:
            fp = "%05d" % int(f)
            county[cid][(fp, y)] = (v, lo, hi)
            names[fp] = r["location_name"]; locs[fp] = r["location_id"]
    fips_all = sorted(f for f in names if f in geo_ids)
    byloc = collections.defaultdict(list)
    for f in names: byloc[locs[f]].append(f)
    merged = {f: [names[g] for g in sorted(byloc[locs[f]]) if g != f] for f in fips_all if len(byloc[locs[f]]) > 1}
    if not merged:
        # 1980-2014 files give merged units separate location ids; identify them by identical 35-year all-cause series (with uncertainty bounds)
        yrs = sorted({int(r["year"]) for r in rows})
        sig = collections.defaultdict(list)
        for f in fips_all:
            t = tuple(county[294].get((f, y)) for y in yrs)
            if None not in t: sig[t].append(f)
        merged = {f: [names[g] for g in grp if g != f] for grp in sig.values() if len(grp) > 1 for f in grp}
        locs = {f: "sig%d" % i for i, grp in enumerate(sig.values()) for f in grp}
    gl = collections.defaultdict(list)
    for f in names: gl[locs.get(f, f)].append(f)
    merged_groups = []
    for key, grp in gl.items():
        mapped = sorted(g for g in grp if g in geo_ids and g in merged)
        if len(mapped) >= 1 and len(grp) > 1:
            merged_groups.append({"fips": mapped, "others": [clean(names[g]) for g in sorted(grp) if g not in geo_ids]})
    print(" merged units:", len({locs[f] for f in merged}), "mapped counties in merged units:", len(merged))
    missing_geo = [f for f in names if f not in geo_ids]
    missing_data = [f for f in geo_ids if f not in names and int(f[:2]) <= 56]
    print(label, "counties", len(fips_all), "years", years[0], years[-1], "causes", len(causes))
    print(" in data not in map:", [(f, names[f]) for f in missing_geo])
    print(" in map not in data:", [(f, geo_ids[f]) for f in missing_data])
    ny = len(years)
    cause_meta = []
    for gname, ids in groups:
        for cid in ids:
            assert cid in causes, cid
            d = county[cid]
            v = []; lo = []; hi = []
            pool = []
            for fp in fips_all:
                for y in years:
                    t = d.get((fp, y), (None, None, None))
                    v.append(rnd(t[0])); lo.append(rnd(t[1])); hi.append(rnd(t[2]))
                    if t[0] is not None: pool.append(t[0])
            json.dump({"cause_id": cid, "v": v, "lo": lo, "hi": hi}, open(os.path.join(out_dir, f"c{cid}.json"), "w"), separators=(",", ":"))
            pool.sort()
            q = lambda p: pool[min(len(pool) - 1, int(p * len(pool)))]
            nat_series = [rnd(nat[cid].get(y, (None,))[0]) for y in years]
            cause_meta.append({"id": cid, "name": causes[cid], "group": gname,
                               "q": {str(p): rnd(q(p)) for p in (0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99)},
                               "n_missing": sum(1 for x in v if x is None) // ny})
    index = {"label": label, "years": years, "fips": fips_all,
             "names": [clean(names[f]) for f in fips_all],
             "states": STATE, "merged_groups": merged_groups,
             "causes": cause_meta,
             "national": {str(cid): [rnd(nat[cid].get(y, (None,))[0]) for y in years] for cid in causes},
             "national_ui": {str(cid): [[rnd(nat[cid].get(y,(None,None,None))[1]), rnd(nat[cid].get(y,(None,None,None))[2])] for y in years] for cid in causes},
             "state": {sf: {str(cid): [rnd(st[sf][cid].get(y, (None,))[0]) for y in years] for cid in causes} for sf in sorted(st)}}
    json.dump(index, open(os.path.join(out_dir, "index.json"), "w"), separators=(",", ":"))
    return index

# 1980-2014
rowsA = []
for f in glob.glob(os.path.join(RAW, "a_1980_2014", "*.CSV")):
    rowsA += list(csv.DictReader(open(f, encoding="utf-8"), fieldnames=["location_id","location_name","fips","cause_id","cause_name","year","rate","lower","upper"]))
groupsA = [("Overall", [294]),
           ("Broad groups", [295, 409, 687]),
           ("Communicable, maternal, neonatal, and nutritional", [296, 301, 344, 366, 380, 386, 392]),
           ("Non-communicable diseases", [410, 491, 508, 521, 526, 542, 558, 586, 626, 640]),
           ("Injuries", [688, 696, 717, 728])]
build(rowsA, os.path.join(REPO, "death-in-america/data/ihme-1980-2014"), groupsA, "1980-2014")

rowsB = []
for f in glob.glob(os.path.join(RAW, "*_asr_total.csv")):
    rowsB += list(csv.DictReader(open(f, encoding="latin-1")))
groupsB = [("Overall", [294]),
           ("Broad groups", [295, 409, 687]),
           ("Communicable, maternal, neonatal, and nutritional", [955, 956, 957, 961, 962, 386]),
           ("Non-communicable diseases", [410, 417, 491, 508, 526, 542, 973, 974, 653, 626, 640]),
           ("Injuries", [688, 696, 717])]
build(rowsB, os.path.join(REPO, "death-in-america/data/ihme-2000-2019"), groupsB, "2000-2019")
