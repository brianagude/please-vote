"""Build a state's ZIP-to-U.S.-House-district list from a new district map.

The address lookup is the main way the site finds your districts. This list is the backup,
used when an address can't be matched. Georgia and New York use a ready-made list
(us-zipcodes-congress), but that list is on the old maps, so a state with new districts
(California, 2026) builds its own:

  1. The new map as a block equivalency file: every Census block and its district.
     California's is AB 604 from the Statewide Database:
     https://statewidedatabase.org/pub/data/d25/AB604.zip
     Texas's is PLANC2333 from the Texas Legislative Council (planc2333_blk.zip):
     https://data.capitol.texas.gov/dataset/planc2333
  2. The Census Bureau's ZIP-to-block list (about 1 GB; read as it downloads, not saved):
     https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_tabblock20_natl.txt

A ZIP code gets every district that holds at least 1% of its land, so a ZIP that crosses
district lines lists each of them (the page then says to double-check).

    python3 scripts/zip-districts.py ca <block-equivalency.csv>

Writes data/states/<state>/zip-to-house.json.
"""
import csv
import io
import json
import sys
import urllib.request
from collections import defaultdict

FIPS = {"ca": "06", "tx": "48"}
CENSUS = "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_tabblock20_natl.txt"

state, bef = sys.argv[1], sys.argv[2]
fips = FIPS[state]

district = {}
with open(bef, encoding="utf-8-sig") as f:
    for row in csv.reader(f):
        if len(row) >= 2 and row[1].strip().isdigit():
            district[row[0].strip()] = int(row[1])
print(f"{len(district)} blocks in the new map")

land = defaultdict(lambda: defaultdict(int))  # ZIP -> district -> land area
unmatched = 0
req = urllib.request.Request(CENSUS, headers={"User-Agent": "PleaseVote/1.0 (nonpartisan voter guide)"})
with urllib.request.urlopen(req) as res:
    for line in io.TextIOWrapper(res, encoding="utf-8-sig"):
        p = line.rstrip("\n").split("|")
        if len(p) < 17 or not p[1] or not p[9].startswith(fips):
            continue
        d = district.get(p[9])
        if d is None:
            unmatched += 1
            continue
        land[p[1]][d] += int(p[15] or 0)

out = {}
for z in sorted(land):
    total = sum(land[z].values())
    ds = sorted(d for d, a in land[z].items() if total == 0 or a / total >= 0.01)
    if ds:
        out[z] = ds
with open(f"data/states/{state}/zip-to-house.json", "w") as f:
    json.dump(out, f, separators=(",", ":"))
multi = sum(len(v) > 1 for v in out.values())
print(f"{len(out)} ZIP codes ({multi} cross district lines); {unmatched} blocks not in the map")
