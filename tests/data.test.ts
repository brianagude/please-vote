// Guards for the hard rules in CLAUDE.md. These run on every push and
// before every nightly deploy; if one fails, the site isn't updated.
import { describe, expect, it } from "vitest";
import { allCandidates, loadState, stateCodes } from "../src/lib/state";
import { byLastName, lastName } from "../src/lib/names";
import { parseCensus } from "../worker/index";

for (const code of stateCodes()) {
  const d = loadState(code);
  describe(`${code}: data`, () => {
    it("every group points at offices that exist", () => {
      for (const g of d.config.groups)
        for (const k of g.races) {
          const key = k.startsWith("@") ? { "@house": "house", "@upper": d.config.districts.upper.office, "@lower": d.config.districts.lower.office }[k] : k.replace("?", "");
          expect(d.offices[key!], `${g.id} → ${k}`).toBeDefined();
          if (!k.startsWith("@") && !k.startsWith("?")) expect(d.races.statewide[k], k).toBeDefined();
        }
    });

    it("has a House race for every district", () => {
      for (let n = 1; n <= d.config.districts.house.count; n++) expect(d.races.house[n], `district ${n}`).toBeDefined();
    });

    it("has every legislative seat, each with a source", () => {
      for (const ch of ["upper", "lower"] as const)
        for (let n = 1; n <= d.config.districts[ch].count; n++) {
          const s = d.legislature[ch][n];
          expect(s, `${ch} ${n}`).toBeDefined();
          expect(s.source?.url, `${ch} ${n} source`).toMatch(/^https:\/\//);
          expect(s.vacant || s.name, `${ch} ${n} name`).toBeTruthy();
        }
    });

    it("candidate ids are unique", () => {
      const ids = allCandidates(d).map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("every source is a real https link", () => {
      for (const c of allCandidates(d))
        for (const f of [c.bio, ...(c.career ?? [])]) if (f?.source) expect(f.source.url, c.name).toMatch(/^https:\/\//);
    });

    it("photos that need credit have it", () => {
      for (const c of allCandidates(d))
        if (c.photo && c.photo.license && !/public domain|CC0/i.test(c.photo.license)) expect(c.photo.credit, c.name).toBeTruthy();
    });

    it("has no rating or ranking language in candidate facts", () => {
      const judged = /\b(best|worst|great|terrible|strong|weak|extreme|radical|failed|corrupt)\b/i;
      for (const c of allCandidates(d))
        for (const f of [c.bio, ...(c.career ?? [])]) if (f) expect(f.text, c.name).not.toMatch(judged);
    });
  });
}

describe("names", () => {
  it("sorts by last name, ignoring nicknames and suffixes", () => {
    const list = byLastName([{ name: 'Henry C. "Hank" Johnson, Jr.' }, { name: "Jon Ossoff" }, { name: "Mike Collins" }]);
    expect(list.map((c) => lastName(c.name))).toEqual(["Collins", "Johnson", "Ossoff"]);
  });
});

describe("address lookup", () => {
  it("reads districts from a Census response", () => {
    const r = parseCensus({
      result: {
        addressMatches: [
          {
            matchedAddress: "206 WASHINGTON ST SW, ATLANTA, GA, 30334",
            geographies: {
              States: [{ STUSAB: "GA" }],
              "120th Congressional Districts": [{ BASENAME: "5" }],
              "2026 State Legislative Districts - Upper": [{ BASENAME: "036" }],
              "2026 State Legislative Districts - Lower": [{ BASENAME: "58" }],
            },
          },
        ],
      },
    });
    expect(r).toEqual({ match: true, matched: "206 WASHINGTON ST SW, ATLANTA, GA, 30334", state: "GA", house: "5", upper: "36", lower: "58" });
  });

  it("reports no match", () => {
    expect(parseCensus({ result: { addressMatches: [] } })).toEqual({ match: false });
  });
});
