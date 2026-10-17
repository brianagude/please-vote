"""Read the Texas Secretary of State's 2026 Ballot Certification PDF into JSON.

Download the PDF from the Nov 3, 2026 election page on sos.state.tx.us into
data/states/tx/sources/, along with the statewide sample ballot from the same page:

    pip install pypdf      # once
    python3 scripts/tx-certification.py data/states/tx/sources/2026-ballot-cert.pdf data/states/tx/sources/2026-sample-ballot.pdf

Writes data/states/tx/sources/certification.json next to the PDF.

The certification lists every race county by county (254 counties), with names in capital
letters. Races that cross counties appear once per county, so they're merged. Statewide
candidates' names are taken in normal case from the sample ballot; everyone else's are put in
normal case by rule (pipeline/import-tx.ts uses Congress's and Open States' spelling for
current officeholders). Only federal and state offices are kept: judges, the State Board of
Education, and county offices are left out (DECISIONS #2, docs/ROADMAP.md).
"""
import json
import os
import re
import sys

from pypdf import PdfReader

pdf, sample = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None
text = "\n".join(p.extract_text() for p in PdfReader(pdf).pages)
dated = re.search(r"this (\d+)\w* day of (\w+), (\d{4})", text)
dated = f"{dated.group(2)} {dated.group(1)}, {dated.group(3)}" if dated else None

PARTIES = {"REP": "Republican", "DEM": "Democrat", "LIB": "Libertarian", "GRE": "Green", "IND": "Independent"}
STATEWIDE = {
    "U. S. SENATOR": "senate",
    "GOVERNOR": "governor",
    "LIEUTENANT GOVERNOR": "ltgov",
    "ATTORNEY GENERAL": "ag",
    "COMPTROLLER OF PUBLIC ACCOUNTS": "comptroller",
    "COMMISSIONER OF THE GENERAL LAND OFFICE": "land",
    "COMMISSIONER OF AGRICULTURE": "agr",
    "RAILROAD COMMISSIONER": "rrc",
}
DISTRICTED = [
    (re.compile(r"^U\. S\. REPRESENTATIVE DISTRICT (\d+)$"), "house"),
    (re.compile(r"^STATE SENATOR, DISTRICT (\d+)$"), "upper"),
    (re.compile(r"^STATE REPRESENTATIVE DISTRICT (\d+)$"), "lower"),
]
# Any other office heading ends the race before it. These words only appear in headings.
HEADING = re.compile(r"\b(JUDGE|JUSTICE|COUNTY|CLERK|COMMISSIONER|ATTORNEY|CONSTABLE|TREASURER|SURVEYOR|SHERIFF|ASSESSOR|PRECINCT|MEMBER|SENATOR|REPRESENTATIVE|GOVERNOR|COMPTROLLER|BOARD|DISTRICT|COURT)\b")
PERSON = re.compile(r"^(.+?) (REP|DEM|LIB|GRE|IND)$")
SKIP = re.compile(r"^(Texas Secretary of State|Page \d+ of|Ballot Certification Report|2026 NOVEMBER GENERAL ELECTION|November 03, 2026)")


def race_of(line):
    if line in STATEWIDE:
        return ("statewide", STATEWIDE[line])
    for rx, kind in DISTRICTED:
        m = rx.match(line)
        if m:
            return (kind, m.group(1))
    return None


races = {}  # (kind, key) -> {name: party}
current = None
# Names still waiting for their party. In some counties the PDF prints a race's names, then the
# next race's heading, then the parties, so a name keeps waiting across a heading until its party
# shows up.
waiting = []  # [(race, name)]


seen = {}  # (race, name) -> parties seen across counties, to catch pairing mistakes


def add(race, n, p):
    races[race].setdefault(n, p)
    seen.setdefault((race, n), set()).add(p)


def give_party(p):
    if waiting:
        race, n = waiting.pop(0)
        add(race, n, p)


lines = [l.strip() for l in text.split("\n")]
start = next(i for i, l in enumerate(lines) if l.startswith("County "))
for l in lines[start:]:
    if not l or SKIP.match(l):
        continue
    if l.startswith("County "):
        waiting, current = [], None
        continue
    r = race_of(l)
    if r:
        current = r
        races.setdefault(current, {})
        continue
    if l in PARTIES:
        give_party(l)
        continue
    m = PERSON.match(l)
    if m and current:
        add(current, m.group(1).strip(), m.group(2))
        continue
    if HEADING.search(l):
        current = None
        continue
    if current:
        waiting.append((current, l))

# Normal-case names: statewide from the sample ballot, the rest by rule.
proper = {}
if sample:
    st = " ".join(p.extract_text() for p in PdfReader(sample).pages)
    st = re.sub(r"-\s*\n\s*", "-", st)
    st = re.sub(r"\s+", " ", st)
    for (kind, key), people in races.items():
        if kind != "statewide":
            continue
        for n in people:
            # The sample ballot spells the same name in normal case.
            rx = re.compile(r"\b" + r"\s*".join(re.escape(w) for w in n.split()) + r"\b", re.I)
            m = rx.search(st)
            if m:
                proper[n] = m.group(0)


def normal_case(n):
    if n in proper:
        return proper[n]
    def word(w):
        if re.fullmatch(r"(II|III|IV|JR\.?|SR\.?)", w):
            return w.title() if w.startswith(("J", "S")) else w
        if re.fullmatch(r"[A-Z]\.", w):
            return w
        if re.fullmatch(r'"[A-Z]{2}"', w):  # two-letter nicknames: "JJ"
            return w
        w = w.lower()
        w = "-".join(p[:1].upper() + p[1:] for p in w.split("-"))
        w = re.sub(r"^(Mc|O')([a-z])", lambda m: m.group(1) + m.group(2).upper(), w)
        w = re.sub(r"^([\"'])([a-z])", lambda m: m.group(1) + m.group(2).upper(), w)  # nicknames: 'RICK'

        return w
    return " ".join(word(w) for w in n.split())


out = {"source": os.path.basename(pdf), "dated": dated, "races": []}
order = {"statewide": 0, "house": 1, "upper": 2, "lower": 3}
for (kind, key), people in sorted(races.items(), key=lambda x: (order[x[0][0]], int(x[0][1]) if x[0][1].isdigit() else 0, x[0][1])):
    out["races"].append({
        "kind": kind,
        "key": key,
        "candidates": [{"name": normal_case(n), "ballotName": n, "party": PARTIES[p]} for n, p in people.items()],
    })

path = os.path.join(os.path.dirname(pdf), "certification.json")
with open(path, "w") as f:
    json.dump(out, f, indent=1, ensure_ascii=False)
    f.write("\n")
count = {}
for r in out["races"]:
    count[r["kind"]] = count.get(r["kind"], 0) + 1
print(f"{len(out['races'])} races, dated {dated} -> {path}")
print(count)
for (race, n), ps in seen.items():
    if len(ps) > 1:
        print("  check: party differs between counties:", race, n, ps)
for r in out["races"]:
    if len(r["candidates"]) < 1:
        print("  check: empty race", r["kind"], r["key"])
