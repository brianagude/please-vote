"""Read the New York State Board of Elections certification PDF into JSON.

elections.ny.gov blocks automated downloads, so the owner saves the PDF by hand
into data/states/ny/sources/. This turns it into a plain, readable list of every
race and every party line, which pipeline/import-ny.ts then uses.

    pip install pypdf      # once
    python3 scripts/ny-certification.py data/states/ny/sources/<file>.pdf

Writes data/states/ny/sources/certification.json next to the PDF.
"""
import json
import os
import re
import sys

from pypdf import PdfReader

pdf = sys.argv[1]
text = "\n".join(p.extract_text(extraction_mode="layout") for p in PdfReader(pdf).pages)
dated = re.search(r"Dated:\s*([A-Za-z]+ \d+, \d{4})", text)
# Page footers can glue onto the next "Office:" line, so drop them first.
text = re.sub(r"^.*Certification for the November 3, 2026 General Election.*Page.*$", "", text, flags=re.M)

races = []
for block in re.split(r"Office:\s*", text)[1:]:
    office = block.split("\n")[0].strip()
    d = re.search(r"District:\s*(.+)", block)
    if not d:
        continue
    district = d.group(1).strip()
    c = re.search(r"Counties:\s*(.+)", block)
    counties = c.group(1).strip() if c else ""
    lines = block.split("\n")
    head = next(i for i, l in enumerate(lines) if re.match(r"\s*Party\s{2,}", l))
    # Rows are separated by blank lines; a long party name or name can wrap onto a second line.
    rows, cur = [], []
    for l in lines[head + 1:]:
        if "Candidate Name" in l:
            continue
        if not l.strip():
            if cur:
                rows.append(cur)
                cur = []
            continue
        cur.append(l)
    if cur:
        rows.append(cur)
    entries = []
    for row in rows:
        party, cells = [], []
        for l in row:
            for m in re.finditer(r"\S+(?: \S+)*", l):
                (party if m.start() < 18 else cells).append((m.start(), m.group()))
        clean = lambda xs: re.sub(r"-\s+", "-", re.sub(r"\s+", " ", " ".join(x for _, x in xs))).strip()
        p = clean(party)
        if not p or p == "Ste":  # footer leftovers
            continue
        if office.startswith("Governor"):
            entries.append({"party": p, "name": clean([c for c in cells if c[0] < 45]), "lt": clean([c for c in cells if c[0] >= 45])})
        else:
            entries.append({"party": p, "name": clean(cells)})
    races.append({"office": office, "district": district, "counties": counties, "lines": entries})

out = os.path.join(os.path.dirname(pdf), "certification.json")
with open(out, "w") as f:
    json.dump({"source": os.path.basename(pdf), "dated": dated.group(1) if dated else None, "races": races}, f, indent=1, ensure_ascii=False)
    f.write("\n")
print(f"{len(races)} races, dated {dated.group(1) if dated else '?'} -> {out}")
