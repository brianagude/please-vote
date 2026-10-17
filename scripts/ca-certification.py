"""Read the California Secretary of State's Certified List of Candidates PDF into JSON.

Download the PDF from the election's page on sos.ca.gov into data/states/ca/sources/.
This turns it into a plain, readable list of every race, which pipeline/import-ca.ts
then uses.

    pip install pypdf      # once
    python3 scripts/ca-certification.py data/states/ca/sources/cert-list-candidates.pdf [data/states/ca/sources/contact-list.pdf]

Writes data/states/ca/sources/certification.json next to the PDF.

The optional second PDF is the Official Candidate Contact List from the same election page.
Only each candidate's campaign website is taken from it (not addresses, phones, or emails).

Each candidate has a name, party preference, ballot designation (the short job title
printed under their name on the ballot), and whether the list marks them as the
incumbent. The list doesn't mark U.S. House incumbents (the districts were redrawn
for 2026), so the import works those out from Congress's own records.
Judges' yes/no retention votes at the end of the list are left out (DECISIONS #2).
"""
import json
import os
import re
import sys

from pypdf import PdfReader

pdf = sys.argv[1]
text = "\n".join(p.extract_text() for p in PdfReader(pdf).pages)
dated = re.search(r"this (\d+)\w* day of (\w+), (\d{4})", text)
dated = f"{dated.group(2)} {dated.group(1)}, {dated.group(3)}" if dated else None

PARTIES = ["Democratic", "Republican", "No Party Preference", "Non-Partisan", "American Independent", "Libertarian", "Green", "Peace and Freedom"]
OFFICE = re.compile(
    r"^(Governor|Lieutenant Governor|Secretary of State|Controller|Treasurer|Attorney General|Insurance Commissioner|"
    r"Superintendent of Public Instruction|(Board of Equalization Member|United States Representative|State Senate|State Assembly Member) District (\d+))$"
)
PERSON = re.compile(r"^(.+?)(\*?)\s+(" + "|".join(PARTIES) + r")$")
FOOTER = re.compile(r"^(General Election - November 3, 2026|Official Certified List of Candidates|\d+/\d+/\d{4}|Page \d+ of \d+|\* Incumbent)$")

lines = [l.strip() for l in text.split("\n")]
start = next(i for i, l in enumerate(lines) if l.startswith("Page 1 of"))
races, race, person = [], None, None
for l in lines[start + 1 :]:
    if l.startswith("Supreme Court - For all"):
        break  # judges from here on
    if not l or FOOTER.match(l):
        continue
    m = OFFICE.match(l)
    if m:
        office = m.group(2) or m.group(1)
        race = {"office": office, "district": m.group(3), "candidates": []}
        races.append(race)
        person = None
        continue
    m = PERSON.match(l)
    if m and race is not None:
        person = {"name": m.group(1).strip(), "party": m.group(3), "incumbent": bool(m.group(2)), "designation": ""}
        race["candidates"].append(person)
        continue
    if person is not None:
        # A long ballot designation can wrap onto a second line.
        person["designation"] = (person["designation"] + " " + l).strip()
        continue
    raise SystemExit(f"Couldn't read this line: {l!r}")

contacts_dated = None
# Campaign websites from the Official Candidate Contact List, matched by name.
if len(sys.argv) > 2:
    ctext = "\n".join(p.extract_text() for p in PdfReader(sys.argv[2]).pages)
    cd = re.search(r"(\d+)/(\d+)/(\d{2,4})", ctext)
    contacts_dated = f"{cd.group(1)}/{cd.group(2)}/{cd.group(3)}" if cd else None
    clines = [l.strip() for l in ctext.split("\n")]
    # The PDF's text sometimes comes out of order, so a website can land next to the wrong
    # person. Only keep a website whose address contains that person's first or last name
    # ("votemikemcguire.com" for Mike McGuire); otherwise leave the link off.
    letters = lambda x: re.sub(r"[^a-z]", "", x.lower())
    def fits(url, name):
        host = letters(re.sub(r"^https?://(www\.)?", "", url).split("/")[0].rsplit(".", 1)[0])
        words = [letters(w) for w in re.sub(r"\(([^)]*)\)", r" \1 ", name).split()]
        return any(len(w) >= 3 and w in host for w in words if w not in ("jr", "sr", "iii"))
    sites, who = {}, None
    for i, l in enumerate(clines):
        m = PERSON.match(l)
        if m:
            who = m.group(1).strip()
            continue
        if who and l.startswith("WEBSITE:"):
            url = l[len("WEBSITE:") :].strip() or (clines[i + 1] if i + 1 < len(clines) else "")
            if re.match(r"^(https?://)?[\w-]+(\.[\w-]+)+(/\S*)?$", url) and fits(url, who):
                sites.setdefault(who, url if url.startswith("http") else "https://" + url)
    names = [c["name"] for r in races for c in r["candidates"]]
    found = 0
    for r in races:
        for c in r["candidates"]:
            url = sites.get(c["name"])
            if url and names.count(c["name"]) == 1:
                c["website"] = url
                found += 1
    print(f"Campaign websites for {found} candidates from the contact list")

for r in races:
    if len(r["candidates"]) != 2:
        print(f"  check: {r['office']} {r['district'] or ''} has {len(r['candidates'])} candidates")

out = os.path.join(os.path.dirname(pdf), "certification.json")
with open(out, "w") as f:
    json.dump({"source": os.path.basename(pdf), "dated": dated, "contactsDated": contacts_dated, "races": races}, f, indent=1, ensure_ascii=False)
    f.write("\n")
count = {}
for r in races:
    count[r["office"]] = count.get(r["office"], 0) + 1
print(f"{len(races)} races, dated {dated} -> {out}")
print(", ".join(f"{k}: {v}" for k, v in count.items()))
