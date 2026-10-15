// Turns the nightly job's raw files into each candidate's career record.
// Facts only, each with its source (DECISIONS #7).
import type { Candidate, CareerRecord } from "./types";
import { partyName } from "./names";

const ord = (n: number) => n + (["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th");

/** Merge back-to-back terms in the same seat into one line. */
function offices(member: any, today: string, stateName: string) {
  const out: { title: string; from: string; to?: string }[] = [];
  for (const t of member.terms) {
    const where = t.state === member.terms.at(-1).state ? stateName : t.state;
    const title = t.type === "sen" ? `U.S. Senate, ${where}` : `U.S. House, ${where}'s ${ord(t.district)} District`;
    const last = out[out.length - 1];
    if (last && last.title === title) last.to = t.end;
    else out.push({ title, from: t.start, to: t.end });
  }
  for (const o of out) if (o.to && o.to >= today) delete o.to;
  return out.reverse();
}

/** Committee titles, in plain words. */
function role(r: { committee: string; parent?: string; title: string }, party: string) {
  const what = r.parent ? `the ${r.committee} subcommittee (part of the ${r.parent})` : `the ${r.committee}`;
  if (/^chair(man|woman)?$/i.test(r.title)) return `Leads ${what}`;
  if (/^vice chair/i.test(r.title)) return `Second in charge of ${what}`;
  if (/^ranking member$/i.test(r.title)) return `Top ${partyName(party) || "minority-party member"} on ${what}`;
  return `${r.title} of ${what}`;
}

export function buildRecord(
  c: Candidate,
  gen: { congress?: any; money?: any; bills?: any },
  cycle: string,
  stateName: string,
  today = new Date().toISOString().slice(0, 10),
): CareerRecord | undefined {
  const rec: CareerRecord = {};
  const m = c.ids?.bioguide && gen.congress?.[c.ids.bioguide];
  if (m) {
    rec.offices = { items: offices(m, today, stateName), source: m.source };
    const titled = m.committees.filter((r: any) => r.title);
    const lead = (m.leadership ?? []).filter((l: any) => !l.end || l.end >= today).map((l: any) => l.title);
    if (titled.length || lead.length) rec.roles = { items: [...lead, ...titled.map((r: any) => role(r, c.party))], source: m.source };
  }
  if (gen.bills?.[c.id]) rec.bills = gen.bills[c.id];
  if (gen.money?.[c.id]) rec.money = gen.money[c.id];
  else if (c.ids?.fec)
    rec.money = { none: true, source: { label: "FEC", url: `https://www.fec.gov/data/candidate/${c.ids.fec}/?cycle=${cycle}&election_full=true` } };
  return Object.keys(rec).length ? rec : undefined;
}
