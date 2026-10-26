import json, urllib.request, urllib.parse, sys, time

BASE = "https://data.cdc.gov/resource/{}.json"
DATASETS = {
  "heart": {
    "2015-2017": "mfvi-hkb9", "2016-2018": "6x7h-usvx", "2017-2019": "s6p7-fvbw",
    "2018-2020": "jiwm-ppbh", "2019-2021": "55yu-xksw", "2021-2023": "th8y-thx5",
    "2022-2024": "mri7-5jtw",
  },
  "stroke": {
    "2015-2017": "v246-z5tb", "2016-2018": "tqwu-4a7k", "2017-2019": "ua33-yiiu",
    "2018-2020": "g5fg-bgtw", "2019-2021": "vutr-sfkh", "2021-2023": "cpdh-8cna",
    "2022-2024": "y5ii-knwc",
  },
}

def fetch(ds, where):
    params = {
        "$select": "locationid,locationdesc,locationabbr,year,data_value,data_value_type,data_value_footnote_symbol",
        "$where": where,
        "$limit": "50000",
    }
    url = BASE.format(ds) + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)

out = {"heart": {}, "stroke": {}}
names = {}
report = []
for cause, periods in DATASETS.items():
    for period, ds in periods.items():
        rows = fetch(ds, "geographiclevel='County' AND stratification1='Overall' AND stratification2='Overall'")
        types = sorted(set(r.get("data_value_type", "") for r in rows))
        years = sorted(set(r.get("year", "") for r in rows))
        vals = {}
        n_val = 0; n_sup = 0
        for r in rows:
            fips = r.get("locationid", "")
            if not fips:
                continue
            v = r.get("data_value")
            if v is None or v == "":
                vals[fips] = None; n_sup += 1
            else:
                try:
                    vals[fips] = float(v); n_val += 1
                except ValueError:
                    vals[fips] = None; n_sup += 1
            if period == "2022-2024":
                names[fips] = {"county": r.get("locationdesc", ""), "state": r.get("locationabbr", "")}
        out[cause][period] = vals
        report.append(f"{cause} {period} ({ds}): rows={len(rows)} valued={n_val} suppressed={n_sup} years={years} types={types}")
        print(report[-1], flush=True)
        time.sleep(1)

json.dump(out, open("county_heart_stroke.json", "w"))
json.dump(names, open("county_names.json", "w"))
print("counties named:", len(names))
print("DONE")
