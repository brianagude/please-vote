// Turn California's Certified List of Candidates into the site's race files.
//
//   python3 scripts/ca-certification.py data/states/ca/sources/cert-list-candidates.pdf   (PDF -> certification.json)
//   node --env-file-if-exists=.env.local pipeline/import-ca.ts
//
// Writes data/states/ca/races.json (statewide offices, U.S. House)
// and data/states/ca/legislature-races.json (State Senate and Assembly).
//
// California's primary sends the top two to November whatever their party, so most races
// have exactly two candidates. The list marks statewide and legislature incumbents with *,
// but not U.S. House members (the districts were redrawn for 2026, and some members run in a
// new district number), so those come from Congress's own records. Candidate details added
// by hand later (bio, career, links, photo) are kept when this runs again.
// Campaign websites come from the Secretary of State's Official Candidate Contact List.
// Each candidate's ballot designation (the job title printed under their name) is shown as "On the ballot as".
// Board of Equalization races and judges are left out for now (see docs/ROADMAP.md).
import path from "node:path";
import { readJSON, stateDir } from "./lib.ts";
import { congressMembers, fecCandidates, houseCandidate, legislatorFor, legislatorsOf, previousCandidates, report, slug, writeRaces } from "./importlib.ts";

const sd = stateDir("ca");
const cert = readJSON(path.join(sd, "sources/certification.json"));
const source = {
  label: `California Secretary of State, Certified List of Candidates (${cert.dated})`,
  url: "https://www.sos.ca.gov/elections/upcoming-elections/general-election-november-3-2026",
};

const STATEWIDE: Record<string, string> = {
  Governor: "governor",
  "Lieutenant Governor": "ltgov",
  "Secretary of State": "sos",
  Controller: "controller",
  Treasurer: "treasurer",
  "Attorney General": "ag",
  "Insurance Commissioner": "ins",
  "Superintendent of Public Instruction": "schools",
};
const PARTY: Record<string, string> = {
  Democratic: "Democrat",
  Republican: "Republican",
  "No Party Preference": "No party preference",
  "Non-Partisan": "Nonpartisan",
};
const party = (p: string) => PARTY[p] ?? p;
/** The job title printed under their name on the ballot, as a sourced fact. */
const ballotAs = (p: any) => (p.designation && p.designation !== "No Ballot Designation" ? { ballotAs: { text: p.designation, source } } : {});

const oldById = previousCandidates(sd);
const { reps } = await congressMembers("CA");
const { list: legislators } = legislatorsOf(sd);

const statewide: Record<string, any> = {};
const house: Record<string, any> = {};
const legislature: any = { source, upper: {}, lower: {} };

for (const r of cert.races) {
  if (STATEWIDE[r.office]) {
    statewide[STATEWIDE[r.office]] = {
      candidates: r.candidates.map((p: any) => {
        const id = slug(p.name);
        const old = oldById.get(id) ?? {};
        const { incumbent: _, ids: oldIds, ...kept } = old; // incumbent always from the list, never kept from last time
        // A sitting state legislator running statewide: link their Open States record, for state bills and votes.
        const leg = legislatorFor(legislators, p.name);
        const { openstates: __, ...restIds } = oldIds ?? {};
        const ids = { ...restIds, ...(leg ? { openstates: leg.openstates } : {}) };
        return {
          ...kept,
          id,
          name: p.name,
          party: party(p.party),
          ...(p.incumbent ? { incumbent: true } : {}),
          ...ballotAs(p),
          links: { ...(p.website ? { campaign: p.website } : {}), ...(old.links ?? {}) },
          ...(Object.keys(ids).length ? { ids } : {}),
        };
      }),
    };
  } else if (r.office === "United States Representative") {
    const fec = await fecCandidates("CA", "H", r.district);
    house[r.district] = {
      candidates: r.candidates.map((p: any) =>
        houseCandidate({
          name: p.name,
          party: party(p.party),
          district: r.district,
          old: oldById.get(slug(p.name)),
          members: reps,
          fec,
          legislators,
          extra: ballotAs(p),
          links: p.website ? { campaign: p.website } : {},
        }),
      ),
    };
  } else if (r.office === "State Senate" || r.office === "State Assembly Member") {
    const ch = r.office === "State Senate" ? "upper" : "lower";
    legislature[ch][r.district] = r.candidates.map((p: any) => ({ name: p.name, party: party(p.party), ...(p.incumbent ? { incumbent: true } : {}), ...ballotAs(p), ...(p.website ? { campaign: p.website } : {}) }));
  }
}

writeRaces(sd, statewide, house, legislature);
report({ statewide, house, legislature, reps, legislators, lowerLabel: "Assembly" });
