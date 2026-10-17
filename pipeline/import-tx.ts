// Turn the Texas Secretary of State's 2026 Ballot Certification into the site's race files.
//
//   python3 scripts/tx-certification.py data/states/tx/sources/2026-ballot-cert.pdf data/states/tx/sources/2026-sample-ballot.pdf
//   node --env-file-if-exists=.env.local pipeline/import-tx.ts
//
// Writes data/states/tx/races.json (U.S. Senate, statewide offices, U.S. House)
// and data/states/tx/legislature-races.json (State Senate and State House).
//
// The certification doesn't mark who holds the seat now, so incumbents come from elsewhere:
// U.S. House members from Congress's own records (matched by FEC ID, then name; the district
// numbers changed for 2026), state legislators from the Open States roster (legislature.json),
// and statewide officeholders from the list below. Current officeholders' names use Congress's
// and Open States' spelling, since the certification prints names in capital letters.
// Candidate details added by hand later (bio, links, photo) are kept when this runs again.
// The State Senate District 22 and State House District 93 special elections, also on Nov 3,
// aren't in the certification (see NOTES below). Judges, the State Board of Education, and
// county offices are left out for now (see docs/ROADMAP.md).
import path from "node:path";
import { readJSON, stateDir } from "./lib.ts";
import {
  congressMembers,
  fecCandidates,
  fecMatch,
  firstOf,
  houseCandidate,
  lastOf,
  legislatorFor,
  legislatorsOf,
  memberFor,
  norm,
  previousCandidates,
  report,
  slug,
  writeRaces,
} from "./importlib.ts";

const sd = stateDir("tx");
const cert = readJSON(path.join(sd, "sources/certification.json"));
const source = {
  label: `Texas Secretary of State, 2026 Ballot Certification (${cert.dated})`,
  url: "https://www.sos.state.tx.us/elections/laws/2026-november-general-election.shtml",
};

// Statewide officeholders running for the same office again, checked on each office's own
// website (Oct 17, 2026): gov.texas.gov, ltgov.texas.gov, glo.texas.gov, comptroller.texas.gov.
// The other statewide officeholders aren't on the November ballot for their seat (Ken Paxton,
// attorney general now, is running for the U.S. Senate).
const INCUMBENT: Record<string, string> = { governor: "Greg Abbott", ltgov: "Dan Patrick", land: "Dawn Buckingham", comptroller: "Don Huffines" };

// Special elections on Nov 3 to finish the current term of two empty seats, certified separately
// by the Secretary of State (Aug 26, 2026; posted by Tarrant County). In both, the candidates are
// the same two people running for the full term, so the race shows once with this note.
const special = (chamber: string, n: string, file: string) => ({
  text: `This seat is empty right now, so it's on your ballot twice: once to finish the current term (until January), and once for the next full term. The same candidates are running in both.`,
  source: {
    label: `Texas Secretary of State, special election ballot certification for ${chamber}, District ${n} (August 26, 2026)`,
    url: `https://www.tarrantcountytx.gov/content/dam/main/elections/2026/1126/notices/ballot_certification/${file}`,
  },
});
const NOTES = {
  upper: { "22": special("State Senate", "22", "SD22_Ballot-Certification-final.pdf") },
  lower: { "93": special("State House", "93", "HD93_Ballot-Certification-final.pdf") },
};
// The special elections' certified candidates, to check against the full-term race.
const SPECIAL = { upper: { "22": ["David Cook", "Amy Martinez-Salas"] }, lower: { "93": ["Alan Blaylock", "Ericka Lomick"] } };

/** Whether a name in capital-letter certification form is this officeholder's. The last names may
 *  differ by a hyphen ("Leo Wilson", "Leo-Wilson"), and the officeholder may go by a nickname
 *  ("Elizabeth \"Liz\" Campos", "Armando Mando Martinez"). */
const samePerson = (official: string, ballot: string) => {
  const words = ballot.replace(/,?\s+(Jr|Sr|II|III|IV)\.?$/i, "").replace(/["']/g, "").split(/\s+/).map(norm);
  const first = norm(firstOf(official));
  const firstMatches = words.slice(0, -1).some((w) => w.length > 1 && (w.startsWith(first) || first.startsWith(w)));
  return firstMatches && words.join("").endsWith(norm(lastOf(official)));
};

const oldById = previousCandidates(sd);
const { reps, senators } = await congressMembers("TX");
const { roster, list: legislators } = legislatorsOf(sd);

const statewide: Record<string, any> = {};
const house: Record<string, any> = {};
const legislature: any = { source, upper: {}, lower: {}, notes: NOTES };

const senateFec = await fecCandidates("TX", "S");

for (const r of cert.races) {
  if (r.kind === "statewide") {
    statewide[r.key] = {
      candidates: r.candidates.map((p: any) => {
        // A sitting member of Congress or state legislator: their own records' spelling and links.
        const member = memberFor([...reps, ...senators], p.name);
        const leg = !member && legislatorFor(legislators, p.name);
        const name = member?.name.official_full ?? leg?.name ?? p.name;
        const id = slug(name);
        const old = oldById.get(id) ?? {};
        const { incumbent: _, ids: oldIds, ...kept } = old; // worked out fresh each run, never kept from last time
        const { openstates: __, bioguide: ___, ...restIds } = oldIds ?? {};
        const fec = r.key === "senate" ? fecMatch(senateFec, name) : undefined;
        const ids = {
          ...restIds,
          ...(leg ? { openstates: leg.openstates } : {}),
          ...(member ? { bioguide: member.id.bioguide } : {}),
          ...(fec ? { fec } : {}),
        };
        return {
          ...kept,
          id,
          name,
          party: p.party,
          ...(INCUMBENT[r.key] && samePerson(INCUMBENT[r.key], name) ? { incumbent: true } : {}),
          links: { ...(old.links ?? {}) },
          ...(Object.keys(ids).length ? { ids } : {}),
        };
      }),
    };
  } else if (r.kind === "house") {
    const fec = await fecCandidates("TX", "H", r.key);
    house[r.key] = {
      candidates: r.candidates.map((p: any) => {
        const member = memberFor(reps, p.name, fecMatch(fec, p.name));
        const name = member?.name.official_full ?? p.name;
        return houseCandidate({ name, party: p.party, district: r.key, old: oldById.get(slug(name)), members: reps, fec, legislators });
      }),
    };
  } else {
    // State Senate and State House: the person holding this district's seat now is the incumbent.
    const now = roster[r.kind]?.[r.key];
    legislature[r.kind][r.key] = r.candidates.map((p: any) => {
      const inc = now && samePerson(now.name, p.name);
      return { name: inc ? now.name : p.name, party: p.party, ...(inc ? { incumbent: true } : {}) };
    });
  }
}
for (const ch of ["upper", "lower"] as const)
  for (const [n, names] of Object.entries<string[]>(SPECIAL[ch])) {
    const full = (legislature[ch][n] ?? []).map((c: any) => c.name).sort();
    if (full.join() !== [...names].sort().join()) console.log(`  check: the ${ch} District ${n} special election's candidates differ from the full-term race (${full.join(", ")}).`);
  }

writeRaces(sd, statewide, house, legislature);
report({ statewide, house, legislature, reps, legislators, lowerLabel: "State House" });
const inc = (ch: string) => Object.values<any>(legislature[ch]).filter((c) => c.some((x: any) => x.incumbent)).length;
console.log(`Legislature races with the current member running: State Senate ${inc("upper")}, State House ${inc("lower")}.`);
console.log(`Statewide incumbents running: ${Object.values<any>(statewide).flatMap((r) => r.candidates).filter((c) => c.incumbent).map((c) => c.name).join(", ")}.`);
